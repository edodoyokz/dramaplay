import { Hono } from "hono";
import { createDb, analyticsEvents } from "@dramaplay/db";
import type { Env } from "../env";
import { authMiddleware } from "../middleware/auth";

export const events = new Hono<{ Bindings: Env; Variables: { user: { id: string } } }>();
events.use("*", authMiddleware);

events.post("/", async (c) => {
  const userId = c.get("user").id;
  const body = await c.req.json<{ event: string; properties?: Record<string, unknown> }>();
  const db = createDb(c.env.DATABASE_URL);
  await db.insert(analyticsEvents).values({
    userId,
    event: body.event,
    properties: body.properties ?? {},
  });
  return c.json({ ok: true });
});
