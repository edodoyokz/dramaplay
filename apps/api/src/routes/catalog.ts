import { Hono } from "hono";
import { createDb, dramas, episodes } from "@dramaplay/db";
import { eq, desc, sql, and } from "drizzle-orm";
import type { Env } from "../env";

export const catalog = new Hono<{ Bindings: Env }>();

// ponytail: in-isolate cache, naive size cap. 120s TTL on static-ish catalog reads.
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 120_000;
const MAX = 500;

function cached<T>(key: string): T | null {
  const hit = cache.get(key);
  return hit && Date.now() - hit.ts < TTL ? (hit.data as T) : null;
}
function store(key: string, data: unknown) {
  if (cache.size > MAX) cache.clear();
  cache.set(key, { data, ts: Date.now() });
}

catalog.get("/trending", async (c) => {
  const hit = cached("trending");
  if (hit) return c.json(hit);
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db
    .select()
    .from(dramas)
    .where(
      and(
        eq(dramas.isPublished, true),
        eq(dramas.visibility, "public")
      )
    )
    .orderBy(desc(dramas.popularityScore))
    .limit(20);
  const body = { items: rows };
  store("trending", body);
  return c.json(body);
});

catalog.get("/new", async (c) => {
  const hit = cached("new");
  if (hit) return c.json(hit);
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(dramas).orderBy(desc(dramas.createdAt)).limit(20);
  const body = { items: rows };
  store("new", body);
  return c.json(body);
});

catalog.get("/dramas/:slug", async (c) => {
  const slug = c.req.param("slug");
  const hit = cached(`drama:${slug}`);
  if (hit) return c.json(hit);
  const db = createDb(c.env.DATABASE_URL);
  const [drama] = await db.select().from(dramas).where(eq(dramas.slug, slug));
  if (!drama) return c.json({ error: "not_found" }, 404);
  const eps = await db
    .select()
    .from(episodes)
    .where(eq(episodes.dramaId, drama.id))
    .orderBy(episodes.episodeNumber);
  const body = { drama, episodes: eps };
  store(`drama:${slug}`, body);
  return c.json(body);
});

catalog.get("/search", async (c) => {
  const q = c.req.query("q") ?? "";
  if (!q) return c.json({ items: [] });
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db
    .select()
    .from(dramas)
    .where(sql`${dramas.title} ilike ${"%" + q + "%"}`)
    .limit(20);
  return c.json({ items: rows });
});
