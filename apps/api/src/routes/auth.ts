import { Hono } from "hono";
import type { Env } from "../env";
import { authMiddleware } from "../middleware/auth";
import { isUserVip } from "../lib/entitlements";

export const auth = new Hono<{ Bindings: Env; Variables: { user: { id: string } } }>();

auth.get("/me", authMiddleware, async (c) => {
  const userId = c.get("user").id;
  const isVip = await isUserVip(c.env.DATABASE_URL, userId);
  return c.json({ user: { id: userId, isVip } });
});
