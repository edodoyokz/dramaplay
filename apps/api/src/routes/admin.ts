import { Hono } from "hono";
import { createDb, providers, dramas, episodes } from "@dramaplay/db";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import { authMiddleware } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";

export const admin = new Hono<{ Bindings: Env }>();
admin.use("*", authMiddleware, adminMiddleware);

admin.get("/providers", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(providers);
  return c.json({ items: rows });
});

admin.post("/providers/:id/toggle", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const [row] = await db.select().from(providers).where(eq(providers.id, c.req.param("id")));
  if (!row) return c.json({ error: "not_found" }, 404);
  await db.update(providers).set({ isEnabled: !row.isEnabled }).where(eq(providers.id, row.id));
  return c.json({ ok: true });
});

admin.get("/dramas", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(dramas).limit(50);
  return c.json({ items: rows });
});

admin.get("/users", async (c) => {
  const { profiles } = await import("@dramaplay/db");
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(profiles).limit(50);
  return c.json({ items: rows });
});

admin.get("/payments", async (c) => {
  const { payments } = await import("@dramaplay/db");
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(payments).limit(50);
  return c.json({ items: rows });
});

admin.get("/reports", async (c) => {
  const { reports } = await import("@dramaplay/db");
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(reports).limit(50);
  return c.json({ items: rows });
});

admin.post("/dramas/:id/access", async (c) => {
  const { accessType } = await c.req.json<{ accessType: "free" | "vip" }>();
  const db = createDb(c.env.DATABASE_URL);
  await db.update(episodes).set({ accessType }).where(eq(episodes.dramaId, c.req.param("id")));
  return c.json({ ok: true });
});
