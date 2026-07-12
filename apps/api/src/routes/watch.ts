import { Hono } from "hono";
import {
  createDb,
  dramas,
  episodes,
  subtitles,
  episodeProviders,
  dramaProviders,
  providers,
  type Database,
} from "@dramaplay/db";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Env } from "../env";
import { buildProviders } from "../providers/registry";
import { subtitleFormatFromUrl, isRenderableSubtitle } from "../providers/sapimu/core/media";
import { isUserVip } from "../lib/entitlements";
import { getUserId } from "../middleware/auth";
import type { Context } from "hono";

export const watch = new Hono<{ Bindings: Env }>();

// ponytail: in-isolate cache, naive size cap. Switch to LRU/KV if hit rate across isolates is poor.
const watchCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60_000;
const CACHE_MAX = 500;

async function getPrimaryProvider(
  db: Database,
  dramaId: string,
): Promise<{ id: string; code: string; name: string; providerDramaId: string } | null> {
  const [row] = await db
    .select({
      id: providers.id,
      code: providers.code,
      name: providers.name,
      providerDramaId: dramaProviders.providerDramaId,
    })
    .from(dramaProviders)
    .innerJoin(providers, eq(dramaProviders.providerId, providers.id))
    .where(and(eq(dramaProviders.dramaId, dramaId), eq(dramaProviders.isPrimary, true)))
    .limit(1);
  return row
    ? {
        id: row.id,
        code: row.code ?? "unknown",
        name: row.name ?? "Unknown",
        providerDramaId: row.providerDramaId,
      }
    : null;
}

async function makeStreamResponse(
  db: Database,
  env: Env,
  drama: typeof dramas.$inferSelect,
  episode: typeof episodes.$inferSelect,
  providerInfo: { id: string; code: string; name: string; providerDramaId: string } | null,
) {
  const [[primary], [nextEpisode], [sub]] = await Promise.all([
    db.select().from(episodeProviders).where(eq(episodeProviders.episodeId, episode.id)).limit(1),
    db
      .select({
        seasonNumber: episodes.seasonNumber,
        episodeNumber: episodes.episodeNumber,
      })
      .from(episodes)
      .where(
        and(
          eq(episodes.dramaId, drama.id),
          sql`(${episodes.seasonNumber}, ${episodes.episodeNumber}) >
              (${episode.seasonNumber}, ${episode.episodeNumber})`,
        ),
      )
      .orderBy(asc(episodes.seasonNumber), asc(episodes.episodeNumber))
      .limit(1),
    db
      .select()
      .from(subtitles)
      .where(
        and(
          eq(subtitles.episodeId, episode.id),
          eq(subtitles.language, "id"),
          eq(subtitles.isEnabled, true),
        ),
      )
      .limit(1),
  ]);

  const adapters = buildProviders(env.PROVIDER_BASE_URL, env.PROVIDER_API_TOKEN);
  const adapter = providerInfo ? adapters[providerInfo.code] : Object.values(adapters)[0];

  let source = adapter
    ? await adapter.resolveStream(primary?.providerEpisodeId ?? "").catch(() => null)
    : null;

  if (!source?.streamUrl && adapter && providerInfo?.code === "dramanova") {
    // ponytail: Dramanova fileIds rotate; refresh just this episode instead of a full resync.
    const fresh = (await adapter.fetchEpisodes(providerInfo.providerDramaId).catch(() => [])).find(
      (e) =>
        (e.seasonNumber ?? 1) === episode.seasonNumber &&
        e.episodeNumber === episode.episodeNumber,
    );
    if (fresh?.providerEpisodeId && fresh.providerEpisodeId !== primary?.providerEpisodeId) {
      source = await adapter.resolveStream(fresh.providerEpisodeId).catch(() => null);
      if (source?.streamUrl && primary) {
        await db
          .update(episodeProviders)
          .set({ providerEpisodeId: fresh.providerEpisodeId })
          .where(
            and(
              eq(episodeProviders.episodeId, episode.id),
              eq(episodeProviders.providerId, providerInfo.id),
            ),
          )
          .catch(() => {});
      }
    }
  }

  if (!source?.streamUrl) {
    return new Response(JSON.stringify({ error: "stream_unavailable", provider: providerInfo }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const providerSubtitle =
    source.subtitleLanguage === "id" && source.subtitleUrl ? source.subtitleUrl : undefined;

  if (providerSubtitle && !sub) {
    const fmt = subtitleFormatFromUrl(providerSubtitle);
    await db
      .insert(subtitles)
      .values({
        episodeId: episode.id,
        language: "id",
        source: "provider",
        format: fmt,
        url: providerSubtitle,
        isDefault: true,
      })
      .onConflictDoNothing()
      .catch(() => {}); // ponytail: best-effort, don't block response
  }

  const servedSubUrl = sub?.url
    ? isRenderableSubtitle(sub.url)
      ? sub.url
      : undefined
    : providerSubtitle
      ? isRenderableSubtitle(providerSubtitle)
        ? providerSubtitle
        : undefined
      : undefined;

  return new Response(
    JSON.stringify({
      streamUrl: source.streamUrl,
      streamType: source.streamType ?? "mp4",
      ...(servedSubUrl
        ? { subtitleUrl: servedSubUrl, subtitleLanguage: "id" as const }
        : {}),
      posterUrl: drama.posterUrl ?? undefined,
      dramaTitle: drama.title,
      dramaSlug: drama.slug,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      accessType: episode.accessType,
      nextEpisode: nextEpisode
        ? {
            seasonNumber: nextEpisode.seasonNumber,
            episodeNumber: nextEpisode.episodeNumber,
          }
        : null,
      provider: providerInfo ? { code: providerInfo.code, name: providerInfo.name } : undefined,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

async function serveWatch(
  c: Context<{ Bindings: Env }>,
  seasonNumber: number,
  episodeNumber: number,
) {
  const slug = c.req.param("slug");
  if (!slug) return c.json({ error: "bad_request" }, 400);
  const key = `${slug}:${seasonNumber}:${episodeNumber}`;
  const hit = watchCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return c.json(hit.data as Record<string, unknown>);
  }

  const db = createDb(c.env.DATABASE_URL);
  const [drama] = await db.select().from(dramas).where(eq(dramas.slug, slug));
  if (!drama) return c.json({ error: "not_found" }, 404);

  const [episode] = await db
    .select()
    .from(episodes)
    .where(
      and(
        eq(episodes.dramaId, drama.id),
        eq(episodes.seasonNumber, seasonNumber),
        eq(episodes.episodeNumber, episodeNumber),
      ),
    );
  if (!episode) return c.json({ error: "not_found" }, 404);

  const providerInfo = await getPrimaryProvider(db, drama.id);

  if (episode.accessType === "vip") {
    const auth = c.req.header("Authorization") ?? "";
    let userId: string | null = null;
    if (auth.startsWith("Bearer ")) {
      try {
        userId = await getUserId(c.env, auth.slice(7));
      } catch {
        userId = null;
      }
    }
    if (userId) {
      try {
        if (await isUserVip(db, userId)) {
          return makeStreamResponse(db, c.env, drama, episode, providerInfo);
        }
      } catch {
        // DB error — fall through to 403 rather than crash
      }
    }
    return c.json(
      {
        accessType: "vip",
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
      },
      403,
    );
  }

  const res = await makeStreamResponse(db, c.env, drama, episode, providerInfo);
  if (res.status === 200) {
    if (watchCache.size > CACHE_MAX) watchCache.clear();
    watchCache.set(key, { data: await res.clone().json(), ts: Date.now() });
  }
  return res;
}

watch.get("/:slug/:season/:episode", async (c) => {
  const seasonNumber = Number(c.req.param("season"));
  const episodeNumber = Number(c.req.param("episode"));
  if (
    !Number.isInteger(seasonNumber) ||
    seasonNumber < 0 ||
    !Number.isInteger(episodeNumber) ||
    episodeNumber < 1
  ) {
    return c.json({ error: "bad_request" }, 400);
  }
  return serveWatch(c, seasonNumber, episodeNumber);
});

watch.get("/:slug/:episode", async (c) => {
  const episodeNumber = Number(c.req.param("episode"));
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
    return c.json({ error: "bad_request" }, 400);
  }
  return serveWatch(c, 1, episodeNumber);
});
