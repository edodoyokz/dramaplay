import { Hono } from "hono";
import type { Env } from "../env";
import { authMiddleware, ensureProfile } from "../middleware/auth";
import { isUserVip } from "../lib/entitlements";

export const auth = new Hono<{ Bindings: Env; Variables: { user: { id: string } } }>();

auth.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  // Profile upsert only on /auth/me (login), not every authenticated request.
  await ensureProfile(c.env, user);
  const isVip = await isUserVip(c.env.DATABASE_URL, user.id);
  return c.json({ user: { id: user.id, email: user.email, isVip } });
});
