import { createClient } from "@supabase/supabase-js";
import { createMiddleware } from "hono/factory";
import { createDb, profiles } from "@dramaplay/db";
import type { Env } from "../env";

export async function getUserId(env: Env, token: string): Promise<string | null> {
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) return null;

    await createDb(env.DATABASE_URL)
      .insert(profiles)
      .values({
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? null,
        avatarUrl: data.user.user_metadata?.avatar_url ?? data.user.user_metadata?.picture ?? null,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          email: data.user.email,
          displayName: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? null,
          avatarUrl: data.user.user_metadata?.avatar_url ?? data.user.user_metadata?.picture ?? null,
        },
      });

    return data.user.id;
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
