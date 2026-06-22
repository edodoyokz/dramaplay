import { createClient } from "@supabase/supabase-js";

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

export async function isAdminUser(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;

    const { role } = await res.json();
    return role !== "user";
  } catch {
    return false;
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session?.access_token) {
    setSession(session.access_token);
  }
  if (event === "SIGNED_OUT") {
    clearSession();
  }
});
