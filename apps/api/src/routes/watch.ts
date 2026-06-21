import { Hono } from "hono";
import { createDb, dramas, episodes, subtitles, episodeProviders } from "@dramaplay/db";
import { and, eq } from "drizzle-orm";
import type { Env } from "../env";
import { buildProviders } from "../providers/registry";
import { isUserVip } from "../lib/entitlements";
import { authMiddleware } from "../middleware/auth";

export const watch = new Hono<{ Bindings: Env }>();

watch.get("/:slug/:n", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const [drama] = await db.select().from(dramas).where(eq(dramas.slug, c.req.param("slug")));
  if (!drama) return c.json({ error: "not_found" }, 404);

  const n = Number(c.req.param("n"));
  const [episode] = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.dramaId, drama.id), eq(episodes.episodeNumber, n)));
  if (!episode) return c.json({ error: "not_found" }, 404);

  if (episode.accessType === "vip") {
    // Require auth header; if present, verify VIP entitlement.
    const auth = c.req.header("Authorization") ?? "";
    if (auth.startsWith("Bearer ")) {
      const userId = await resolveUserId(c.env, auth.slice(7));
      if (userId && (await isUserVip(c.env.DATABASE_URL, userId))) {
        return streamResponse(c.env, drama, episode);
      }
    }
    return c.json({ accessType: "vip", episodeNumber: episode.episodeNumber }, 403);
  }

  return streamResponse(c.env, drama, episode);
});

async function streamResponse(env: Env, drama: typeof dramas.$inferSelect, episode: typeof episodes.$inferSelect) {
  const db = createDb(env.DATABASE_URL);
  const [primary] = await db
    .select()
    .from(episodeProviders)
    .where(eq(episodeProviders.episodeId, episode.id));

  const providers = buildProviders(env.PROVIDER_BASE_URL);
  const provider = primary
    ? Object.values(providers)[0]
    : Object.values(providers)[0];

  const source = provider ? await provider.resolveStream(primary?.providerEpisodeId ?? "").catch(() => null) : null;

  const [sub] = await db
    .select()
    .from(subtitles)
    .where(
      and(
        eq(subtitles.episodeId, episode.id),
        eq(subtitles.language, "id"),
        eq(subtitles.isEnabled, true)
      )
    )
    .limit(1);

  return new Response(
    JSON.stringify({
      streamUrl: source?.streamUrl ?? "",
      streamType: source?.streamType ?? "mp4",
      subtitleUrl: sub?.url ?? undefined,
      posterUrl: drama.backdropUrl ?? drama.posterUrl ?? undefined,
      episodeNumber: episode.episodeNumber,
      accessType: episode.accessType,
    }),
    { headers: { "content-type": "application/json" } }
  );
}

async function resolveUserId(env: Env, token: string): Promise<string | null> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

// Re-export auth middleware for convenience in VIP-only variants.
export { authMiddleware };
