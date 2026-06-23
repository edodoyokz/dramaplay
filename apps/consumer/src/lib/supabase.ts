import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? "",
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""
);

// Persist token so PricingModal / other components can fall back
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session?.access_token) {
    localStorage.setItem("dramaplay:token", session.access_token);
  }
  if (event === "SIGNED_OUT") {
    localStorage.removeItem("dramaplay:token");
  }
});

export function getAuthToken(): string | null {
  return localStorage.getItem("dramaplay:token");
}
