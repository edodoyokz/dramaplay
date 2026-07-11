# Dramaplay

Mobile-first vertical short drama platform for Indonesia.

Multi-provider aggregator with VIP subscription (Pakasir), admin ops console,
PWA (+ Capacitor Android later), on Cloudflare Pages + Workers, Supabase
PostgreSQL + Drizzle ORM.

## Structure

```
apps/
  consumer/   Vite + React + PWA  (dramaplay.my.id)
  admin/      Vite + React        (admin.dramaplay.my.id)
  api/        Cloudflare Workers  (api.dramaplay.my.id)
packages/
  db/         Drizzle schema + client (Supabase PostgreSQL)
  shared/     Shared types (provider adapter contract)
```

## Docs (current)

- Local dev: `docs/setup/local-dev.md`
- Supabase Auth: `docs/setup/supabase-auth.md`
- Production deploy: `docs/deploy/production-deploy.md`
- Launch checklist: `docs/launch-readiness.md`
- Provider notes: `docs/providers/sapimu-provider-wiki.md`
- Historical plans/audits: `docs/archive/` (do not follow as current)

## Provider engine

Sapimu providers use the modular v2 adapters under
`apps/api/src/providers/sapimu/providers/`. There is no legacy engine flag.

## Engagement

Likes / favorites / continue-watching are **client-only**
(`apps/consumer/src/lib/local-engagement.ts`). DB tables in
`packages/db/src/schema/engagement.ts` are unused until cross-device sync is needed.

## Quick start

```bash
pnpm install
cp .env.example .env        # then edit
pnpm --filter @dramaplay/db db:migrate
pnpm dev
```

## Scripts

```bash
pnpm dev                  # all apps
pnpm test                 # workspace tests
pnpm --filter @dramaplay/api run deploy
pnpm --filter @dramaplay/api smoke:providers
pnpm --filter @dramaplay/api smoke:subscription
```
