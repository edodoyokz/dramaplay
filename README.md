# Dramaplay

Mobile-first vertical short drama platform for Indonesia.

Multi-provider aggregator with VIP subscription (Pakasir), full admin panel,
PWA + Android (Capacitor), deployed on Cloudflare Pages + Workers, backed by
Supabase PostgreSQL + Drizzle ORM.

## Structure

```
apps/
  consumer/   Vite + React + PWA  (dramaplay.id)
  admin/      Vite + React        (admin.dramaplay.id)
  api/        Cloudflare Workers  (api.dramaplay.id)
packages/
  db/         Drizzle schema + client (Supabase PostgreSQL)
  shared/     Shared types (provider adapter contract)
```

## Docs

- PRD: `docs/plans/2026-06-21-dramaplay-prd-design.md`
- Implementation plan: `docs/plans/2026-06-21-dramaplay-implementation-plan.md`
- Local dev: `docs/setup/local-dev.md`
- Supabase Auth: `docs/setup/supabase-auth.md`

## Quick start

```bash
pnpm install
cp .env.example .env        # then edit
pnpm --filter @dramaplay/db db:migrate
pnpm dev
```
