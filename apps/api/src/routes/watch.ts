import { Hono } from "hono";
import { createDb, dramas, episodes, subtitles, episodeProviders, type Database } from "@dramaplay/db";
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

watch.get("/:slug/:n", async (c) => {
  const slug = c.req.param("slug");
  const n = Number(c.req.param("n"));

  // Cache is only ever populated by free episodes, so a hit is safe to serve
  // before any DB call. VIP episodes never land here.
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

  if (episode.accessType === "vip") {
    // VIP must re-check entitlement every request — never served from cache.
    const auth = c.req.header("Authorization") ?? "";
    if (auth.startsWith("Bearer ")) {
      const userId = await getUserId(c.env, auth.slice(7));
      if (userId && (await isUserVip(db, userId))) {
        return streamResponse(db, c.env, drama, episode);
      }
    }
    return c.json({ accessType: "vip", episodeNumber: episode.episodeNumber }, 403);
  }

  const res = await streamResponse(db, c.env, drama, episode);
  if (res.status === 200) {
    if (watchCache.size > CACHE_MAX) watchCache.clear();
    watchCache.set(key, { data: await res.clone().json(), ts: Date.now() });
  }
  return res;
});

async function streamResponse(
  db: Database,
  env: Env,
  drama: typeof dramas.$inferSelect,
  episode: typeof episodes.$inferSelect
) {
  // nextEpisode + subtitles are independent of the stream and of each other — run concurrently
  // with the provider lookup (which feeds resolveStream).
  const [[primary], [nextEpisode], [sub]] = await Promise.all([
    db.select().from(episodeProviders).where(eq(episodeProviders.episodeId, episode.id)).limit(1),
    db
      .select({ episodeNumber: episodes.episodeNumber })
      .from(episodes)
      .where(and(eq(episodes.dramaId, drama.id), eq(episodes.episodeNumber, episode.episodeNumber + 1)))
      .limit(1),
    db
      .select()
      .from(subtitles)
      .where(
        and(
          eq(subtitles.episodeId, episode.id),
          eq(subtitles.language, "id"),
          eq(subtitles.isEnabled, true)
        )
      )
      .limit(1),
  ]);

  const providers = buildProviders(env.PROVIDER_BASE_URL, env.PROVIDER_API_TOKEN);
  const provider = Object.values(providers)[0];

  const source = provider
    ? await provider.resolveStream(primary?.providerEpisodeId ?? "").catch(() => null)
    : null;

  if (!source?.streamUrl) {
    return new Response(JSON.stringify({ error: "stream_unavailable" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      streamUrl: source.streamUrl,
      streamType: source.streamType ?? "mp4",
      subtitleUrl: sub?.url ?? undefined,
      posterUrl: drama.posterUrl ?? undefined,
      dramaTitle: drama.title,
      dramaSlug: drama.slug,
      episodeNumber: episode.episodeNumber,
      accessType: episode.accessType,
      nextEpisode: nextEpisode?.episodeNumber ?? null,
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
