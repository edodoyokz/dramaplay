import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function setSession(token: string) {
  localStorage.setItem("dp_admin_token", token);
}

export function clearSession() {
  localStorage.removeItem("dp_admin_token");
}

export function getToken(): string {
  return localStorage.getItem("dp_admin_token") ?? "";
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function isAdminUser(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const role = user.app_metadata?.role ?? user.user_metadata?.role;
  if (
    role &&
    ["super_admin", "editor", "moderator", "finance", "support"].includes(
      role as string,
    )
  ) {
    return true;
  }
  try {
    const token = getToken();
    if (!token) return false;
    const res = await fetch(
      `${import.meta.env.VITE_API_URL ?? ""}/admin/me`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) {
      const { role: profileRole } = await res.json();
      return profileRole !== "user";
    }
  } catch {
    /* offline */
  }
  return false;
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session?.access_token) {
    setSession(session.access_token);
  }
  if (event === "SIGNED_OUT") {
    clearSession();
  }
});
