# Local Development

## Prerequisites

- Node.js 20+
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Supabase project (local CLI or cloud)
- Cloudflare account (for deploy)

## Setup

```bash
pnpm install
cp .env.example .env            # fill DATABASE_URL etc.
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

## Run

```bash
pnpm dev                        # all apps in parallel
pnpm --filter @dramaplay/api dev
pnpm --filter @dramaplay/consumer dev
pnpm --filter @dramaplay/admin dev
```

## Database

```bash
pnpm --filter @dramaplay/db db:generate
pnpm --filter @dramaplay/db db:migrate
pnpm --filter @dramaplay/db db:seed
```

## Type-check & Build

```bash
pnpm typecheck
pnpm build
```
