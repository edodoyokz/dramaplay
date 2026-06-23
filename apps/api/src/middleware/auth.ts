import { createClient } from "@supabase/supabase-js";
import { createMiddleware } from "hono/factory";
import type { Env } from "../env";

export async function getUserId(env: Env, token: string): Promise<string | null> {
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await supabase.auth.getUser();
    return error || !data.user ? null : data.user.id;
  } catch {
    return null;
  }
}

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { user: { id: string } };
}>(async (c, next) => {
  const auth = c.req.header("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return c.json({ error: "unauthorized" }, 401);

  const userId = await getUserId(c.env, auth.slice(7));
  if (!userId) return c.json({ error: "unauthorized" }, 401);

  c.set("user", { id: userId });
  await next();
});
