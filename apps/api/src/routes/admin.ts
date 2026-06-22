import { Hono } from "hono";
import { createDb, providers, dramas, episodes, profiles } from "@dramaplay/db";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import { authMiddleware } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import { syncProvider } from "../sync/sync";

export const admin = new Hono<{ Bindings: Env; Variables: { user: { id: string } } }>();

// /me needs only auth (not admin) so the admin panel login page can check the user role
admin.get("/me", authMiddleware, async (c) => {
  const userId = c.get("user").id;
  const db = createDb(c.env.DATABASE_URL);
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId));
  return c.json({ role: profile?.role ?? "user" });
});

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

admin.post("/providers/:code/sync", async (c) => {
  const result = await syncProvider(
    c.env.DATABASE_URL,
    c.req.param("code"),
    c.env.PROVIDER_BASE_URL,
    c.env.PROVIDER_API_TOKEN
  );
  return c.json({ ok: true, ...result });
});

admin.get("/dramas", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(dramas).limit(50);
  return c.json({ items: rows });
});

admin.get("/users", async (c) => {
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
