# Supabase Auth setup (manual, one-time)

1. Go to Supabase dashboard → Authentication → Providers.
2. Enable **Email** provider (with confirm email optional for dev).
3. Enable **Google** OAuth:
   - Create OAuth credentials in Google Cloud Console.
   - Set redirect URL: `https://<project>.supabase.co/auth/v1/callback`.
   - Paste Client ID and Client Secret into Supabase.
4. Authentication → URL Configuration:
   - Site URL: `http://localhost:5173` (dev) or `https://dramaplay.my.id` (prod).
   - Redirect URLs:
     - `http://localhost:5173/auth/callback`
     - `https://dramaplay.my.id/auth/callback`
5. SQL Editor → run `packages/db/supabase/profiles-trigger.sql` to auto-provision `profiles` rows on signup.
