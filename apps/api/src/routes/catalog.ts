import { Hono } from "hono";
import { createDb, dramas, episodes } from "@dramaplay/db";
import { eq, desc, sql, and } from "drizzle-orm";
import type { Env } from "../env";

export const catalog = new Hono<{ Bindings: Env }>();

catalog.get("/trending", async (c) => {
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
  return c.json({ items: rows });
});

catalog.get("/new", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(dramas).orderBy(desc(dramas.createdAt)).limit(20);
  return c.json({ items: rows });
});

catalog.get("/dramas/:slug", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const [drama] = await db.select().from(dramas).where(eq(dramas.slug, c.req.param("slug")));
  if (!drama) return c.json({ error: "not_found" }, 404);
  const eps = await db
    .select()
    .from(episodes)
    .where(eq(episodes.dramaId, drama.id))
    .orderBy(episodes.episodeNumber);
  return c.json({ drama, episodes: eps });
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
