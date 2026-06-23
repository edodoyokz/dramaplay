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
import { and, eq } from "drizzle-orm";
import type { Env } from "../env";
import { buildProviders } from "../providers/registry";
import { isUserVip } from "../lib/entitlements";
import { getUserId } from "../middleware/auth";

export const watch = new Hono<{ Bindings: Env }>();

// ponytail: in-isolate cache, naive size cap. Switch to LRU/KV if hit rate across isolates is poor.
const watchCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60_000;
const CACHE_MAX = 500;

async function getPrimaryProvider(
  db: Database,
  dramaId: string,
): Promise<{ code: string; name: string } | null> {
  const [row] = await db
    .select({ code: providers.code, name: providers.name })
    .from(dramaProviders)
    .innerJoin(providers, eq(dramaProviders.providerId, providers.id))
    .where(and(eq(dramaProviders.dramaId, dramaId), eq(dramaProviders.isPrimary, true)))
    .limit(1);
  return row ? { code: row.code ?? "unknown", name: row.name ?? "Unknown" } : null;
}

async function makeStreamResponse(
  db: Database,
  env: Env,
  dramaId: string,
  drama: typeof dramas.$inferSelect,
  episode: typeof episodes.$inferSelect,
  providerInfo: { code: string; name: string } | null,
) {
  const [[primary], [nextEpisode], [sub]] = await Promise.all([
    db.select().from(episodeProviders).where(eq(episodeProviders.episodeId, episode.id)).limit(1),
    db
      .select({ episodeNumber: episodes.episodeNumber })
      .from(episodes)
      .where(
        and(eq(episodes.dramaId, drama.id), eq(episodes.episodeNumber, episode.episodeNumber + 1)),
      )
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

  const providers = buildProviders(env.PROVIDER_BASE_URL, env.PROVIDER_API_TOKEN);
  const adapter = providerInfo ? providers[providerInfo.code] : Object.values(providers)[0];

  const source = adapter
    ? await adapter.resolveStream(primary?.providerEpisodeId ?? "").catch(() => null)
    : null;

  if (!source?.streamUrl) {
    return new Response(JSON.stringify({ error: "stream_unavailable", provider: providerInfo }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      streamUrl: source.streamUrl,
      streamType: source.streamType ?? "mp4",
      subtitleUrl: sub?.url ?? source.subtitleUrl ?? undefined,
      posterUrl: drama.posterUrl ?? undefined,
      dramaTitle: drama.title,
      dramaSlug: drama.slug,
      episodeNumber: episode.episodeNumber,
      accessType: episode.accessType,
      nextEpisode: nextEpisode?.episodeNumber ?? null,
      provider: providerInfo ?? undefined,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

watch.get("/:slug/:n", async (c) => {
  const slug = c.req.param("slug");
  const n = Number(c.req.param("n"));

  // Cache checked before DB call; cache key uses slug:n so it is provider-aware.
  const key = `${slug}:${n}`;
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
    .where(and(eq(episodes.dramaId, drama.id), eq(episodes.episodeNumber, n)));
  if (!episode) return c.json({ error: "not_found" }, 404);

  // Fetch provider badge concurrently with the episode lookup.
  const [providerInfo] = await Promise.all([getPrimaryProvider(db, drama.id)]);

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
          return makeStreamResponse(db, c.env, drama.id, drama, episode, providerInfo);
        }
      } catch {
        // DB error — fall through to 403 rather than crash
      }
    }
    return c.json({ accessType: "vip", episodeNumber: episode.episodeNumber }, 403);
  }

  const res = await makeStreamResponse(db, c.env, drama.id, drama, episode, providerInfo);
  if (res.status === 200) {
    if (watchCache.size > CACHE_MAX) watchCache.clear();
    watchCache.set(key, { data: await res.clone().json(), ts: Date.now() });
  }
  return res;
});
