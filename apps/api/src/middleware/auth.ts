import { createClient } from "@supabase/supabase-js";
import { createMiddleware } from "hono/factory";
import { createDb, profiles } from "@dramaplay/db";
import type { Env } from "../env";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/** JWT → user fields. No DB write (watch/report hot paths stay cheap). */
export async function getAuthUser(env: Env, token: string): Promise<AuthUser | null> {
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) return null;
    return {
      id: data.user.id,
      email: data.user.email,
      displayName: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? null,
      avatarUrl: data.user.user_metadata?.avatar_url ?? data.user.user_metadata?.picture ?? null,
    };
  } catch {
    return null;
  }
}

export async function getUserId(env: Env, token: string): Promise<string | null> {
  const user = await getAuthUser(env, token);
  return user?.id ?? null;
}

/** Upsert profile for FK targets (payments/subscriptions). Call on login/checkout. */
export async function ensureProfile(env: Env, user: AuthUser): Promise<void> {
  await createDb(env.DATABASE_URL)
    .insert(profiles)
    .values({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    });
}

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { user: AuthUser };
}>(async (c, next) => {
  const auth = c.req.header("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return c.json({ error: "unauthorized" }, 401);

  const user = await getAuthUser(c.env, auth.slice(7));
  if (!user) return c.json({ error: "unauthorized" }, 401);

  c.set("user", user);
  await next();
});
