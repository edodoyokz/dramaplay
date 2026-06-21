import { createMiddleware } from "hono/factory";
import { createDb, profiles } from "@dramaplay/db";
import { eq } from "drizzle-orm";
import type { Env } from "../env";

const ADMIN_ROLES = ["super_admin", "editor", "moderator", "finance", "support"];

export const adminMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { user: { id: string }; adminRole: string };
}>(async (c, next) => {
  const userId = c.get("user")?.id;
  if (!userId) return c.json({ error: "unauthorized" }, 401);

  const db = createDb(c.env.DATABASE_URL);
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId));
  if (!profile || profile.isBanned) return c.json({ error: "forbidden" }, 403);
  if (!ADMIN_ROLES.includes(profile.role)) return c.json({ error: "forbidden" }, 403);

  c.set("adminRole", profile.role);
  await next();
});
