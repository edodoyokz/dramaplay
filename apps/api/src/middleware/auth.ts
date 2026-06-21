import { createClient } from "@supabase/supabase-js";
import { createMiddleware } from "hono/factory";
import type { Env } from "../env";

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { user: { id: string } };
}>(async (c, next) => {
  const auth = c.req.header("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return c.json({ error: "unauthorized" }, 401);
  const token = auth.slice(7);

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return c.json({ error: "unauthorized" }, 401);

  c.set("user", { id: data.user.id });
  await next();
});
