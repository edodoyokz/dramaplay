# Dramaplay MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a mobile-first vertical short drama streaming platform (Dramaplay MVP) targeting the Indonesian market, with multi-provider catalog, VIP subscription via Pakasir, full admin panel, PWA + Android (Capacitor), deployed on Cloudflare Pages + Workers, using Supabase PostgreSQL + Drizzle ORM.

**Architecture:** pnpm monorepo with three apps (`apps/consumer`, `apps/admin`, `apps/api`) and two shared packages (`packages/db`, `packages/shared`). Consumer and admin are Vite + React SPAs deployed to Cloudflare Pages. API is Cloudflare Workers using Drizzle + Supabase. Provider content is ingested via an adapter layer with cached metadata in Postgres and live stream URL resolution at playback.

**Tech Stack:** pnpm, TypeScript, Vite, React, Tailwind CSS, Cloudflare Pages, Cloudflare Workers (Hono), Supabase (PostgreSQL + Auth), Drizzle ORM, Video.js + HLS.js, Pakasir, Capacitor, GitHub Actions, Vitest, Playwright.

**Reference:** `docs/plans/2026-06-21-dramaplay-prd-design.md`

---

## Conventions

- All commands assume repository root unless otherwise stated.
- Use **conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`.
- Every task ends with a commit.
- Every database change goes through a Drizzle migration.
- Never commit secrets. Use `.dev.vars` (gitignored) for local Workers secrets.
- Branch: `feat/dramaplay-mvp` (create in Phase 1).

---

# Phase 1: Monorepo & Tooling Foundation

## Task 1.1: Initialize Git repo and base structure

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `package.json`

**Step 1: Init repo**

```bash
git init
git checkout -b main
```

**Step 2: Create `.gitignore`**

```gitignore
# deps
node_modules/
.pnpm-store/

# build
dist/
build/
.next/
.turbo/
.wrangler/
.dev.vars
.dev.vars.*

# env
.env
.env.*
!.env.example

# editor
.vscode/
.idea/
.DS_Store

# logs
*.log
npm-debug.log*

# testing
coverage/
playwright-report/
test-results/

# capacitor
apps/consumer/android/app/build/
apps/consumer/android/.gradle/
```

**Step 3: Create root `package.json`**

```json
{
  "name": "dramaplay",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint",
    "typecheck": "pnpm -r run typecheck"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

**Step 4: Commit**

```bash
git add .gitignore README.md package.json
git commit -m "chore: initialize dramaplay monorepo"
```

---

## Task 1.2: Configure pnpm workspace

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`

**Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  }
}
```

**Step 3: Commit**

```bash
git add pnpm-workspace.yaml tsconfig.base.json
git commit -m "chore: configure pnpm workspace and base tsconfig"
```

---

## Task 1.3: Create feature branch and shared package skeletons

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`

**Step 1: Create feature branch**

```bash
git checkout -b feat/dramaplay-mvp
```

**Step 2: Create `packages/shared/package.json`**

```json
{
  "name": "@dramaplay/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

**Step 3: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

**Step 4: Create `packages/shared/src/index.ts`**

```ts
export const DRAMAPLAY_APP_NAME = "Dramaplay";
```

**Step 5: Create `packages/db/package.json`**

```json
{
  "name": "@dramaplay/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

**Step 6: Commit**

```bash
git add packages/
git commit -m "feat: scaffold shared and db packages"
```

---

## Task 1.4: Install root dev tooling

**Step 1: Install tooling**

```bash
pnpm add -Dw -i prettier@^3.3.3
pnpm add -Dw -i eslint@^9.13.0
pnpm add -Dw -i @typescript-eslint/parser@^8.10.0
pnpm add -Dw -i @typescript-eslint/eslint-plugin@^8.10.0
pnpm add -Dw -i vitest@^2.1.3
pnpm add -Dw -i typescript@^5.6.3
```

**Step 2: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

**Step 3: Create `.editorconfig`**

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

**Step 4: Commit**

```bash
git add .
git commit -m "chore: add prettier, eslint, vitest, editorconfig"
```

---

# Phase 2: Database Schema (Drizzle + Supabase)

## Task 2.1: Install Drizzle in `packages/db`

**Step 1: Install deps**

```bash
pnpm --filter @dramaplay/db add drizzle-orm@^0.36.0 postgres@^3.4.0
pnpm --filter @dramaplay/db add -D drizzle-kit@^0.28.0 @types/node
```

**Step 2: Create `packages/db/drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 3: Commit**

```bash
git add packages/db
git commit -m "feat(db): add drizzle config"
```

---

## Task 2.2: Schema — users & profiles

**Files:**
- Create: `packages/db/src/schema/users.ts`

**Step 1: Write schema**

```ts
import { pgTable, uuid, text, timestamp, boolean, primaryKey } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["user", "super_admin", "editor", "moderator", "finance", "support"] })
    .notNull()
    .default("user"),
  isBanned: boolean("is_banned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**Step 2: Generate migration**

```bash
pnpm --filter @dramaplay/db db:generate
```

Expected: new file under `packages/db/drizzle/` referencing `profiles` table.

**Step 3: Commit**

```bash
git add packages/db
git commit -m "feat(db): add profiles table"
```

---

## Task 2.3: Schema — providers & catalog

**Files:**
- Create: `packages/db/src/schema/catalog.ts`

**Step 1: Write schema**

```ts
import { pgTable, uuid, text, integer, timestamp, boolean, jsonb, real } from "drizzle-orm/pg-core";
import { profiles } from "./users";

export const providers = pgTable("providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  baseUrl: text("base_url"),
  priority: integer("priority").notNull().default(100),
  isEnabled: boolean("is_enabled").notNull().default(true),
  config: jsonb("config").$type<Record<string, unknown>>().default({}).notNull(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status", { enum: ["success", "partial", "failed", "running"] }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dramas = pgTable("dramas", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  originalTitle: text("original_title"),
  synopsis: text("synopsis"),
  posterUrl: text("poster_url"),
  backdropUrl: text("backdrop_url"),
  country: text("country"),
  language: text("language"),
  year: integer("year"),
  genres: text("genres").array().default([]).notNull(),
  tags: text("tags").array().default([]).notNull(),
  episodeCount: integer("episode_count").default(0).notNull(),
  rating: real("rating").default(0).notNull(),
  popularityScore: real("popularity_score").default(0).notNull(),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(true),
  isBroken: boolean("is_broken").notNull().default(false),
  visibility: text("visibility", { enum: ["public", "hidden"] }).notNull().default("public"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dramaProviders = pgTable(
  "drama_providers",
  {
    dramaId: uuid("drama_id")
      .notNull()
      .references(() => dramas.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    providerDramaId: text("provider_drama_id").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.dramaId, t.providerId] })]
);

export const episodes = pgTable("episodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  dramaId: uuid("drama_id")
    .notNull()
    .references(() => dramas.id, { onDelete: "cascade" }),
  episodeNumber: integer("episode_number").notNull(),
  title: text("title"),
  thumbnailUrl: text("thumbnail_url"),
  durationSeconds: integer("duration_seconds"),
  accessType: text("access_type", { enum: ["free", "vip"] }).notNull().default("free"),
  isBroken: boolean("is_broken").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const episodeProviders = pgTable(
  "episode_providers",
  {
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    providerEpisodeId: text("provider_episode_id").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.episodeId, t.providerId] })]
);
```

**Step 2: Generate migration**

```bash
pnpm --filter @dramaplay/db db:generate
```

**Step 3: Commit**

```bash
git add packages/db
git commit -m "feat(db): add providers, dramas, episodes schema"
```

---

## Task 2.4: Schema — subtitles, stream cache

**Files:**
- Create: `packages/db/src/schema/media.ts`

**Step 1: Write schema**

```ts
import { pgTable, uuid, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { episodes } from "./catalog";

export const subtitles = pgTable("subtitles", {
  id: uuid("id").defaultRandom().primaryKey(),
  episodeId: uuid("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  source: text("source", { enum: ["provider", "internal"] }).notNull(),
  format: text("format", { enum: ["vtt", "srt", "embedded"] }).notNull(),
  url: text("url"),
  isDefault: boolean("is_default").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(true),
  isBroken: boolean("is_broken").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const streamResolveCache = pgTable("stream_resolve_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  episodeId: uuid("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").references(() => undefined as never),
  streamUrl: text("stream_url").notNull(),
  streamType: text("stream_type", { enum: ["mp4", "m3u8", "other"] }).notNull(),
  quality: text("quality"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**Step 2: Generate migration**

```bash
pnpm --filter @dramaplay/db db:generate
```

**Step 3: Commit**

```bash
git add packages/db
git commit -m "feat(db): add subtitles and stream resolve cache"
```

---

## Task 2.5: Schema — subscription, payments, entitlement

**Files:**
- Create: `packages/db/src/schema/billing.ts`

**Step 1: Write schema**

```ts
import { pgTable, uuid, text, integer, timestamp, boolean, primaryKey } from "drizzle-orm/pg-core";
import { profiles } from "./users";

export const plans = pgTable("plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  durationDays: integer("duration_days").notNull(),
  priceIdr: integer("price_idr").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  status: text("status", { enum: ["active", "expired", "canceled"]).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  amountIdr: integer("amount_idr").notNull(),
  status: text("status", { enum: ["pending", "paid", "failed", "expired"]).notNull().default("pending"),
  pakasirReference: text("pakasir_reference"),
  pakasirTransactionId: text("pakasir_transaction_id"),
  payload: text("payload"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**Step 2: Generate migration**

```bash
pnpm --filter @dramaplay/db db:generate
```

**Step 3: Commit**

```bash
git add packages/db
git commit -m "feat(db): add plans, subscriptions, payments"
```

---

## Task 2.6: Schema — engagement & ops

**Files:**
- Create: `packages/db/src/schema/engagement.ts`
- Create: `packages/db/src/schema/ops.ts`

**Step 1: `engagement.ts`**

```ts
import { pgTable, uuid, text, integer, real, timestamp, boolean, primaryKey } from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { dramas, episodes } from "./catalog";

export const watchProgress = pgTable(
  "watch_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    positionSeconds: integer("position_seconds").notNull().default(0),
    durationSeconds: integer("duration_seconds"),
    isCompleted: boolean("is_completed").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.episodeId] })]
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    dramaId: uuid("drama_id")
      .notNull()
      .references(() => dramas.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dramaId] })]
);

export const episodeLikes = pgTable(
  "episode_likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.episodeId] })]
);

export const dramaRatings = pgTable(
  "drama_ratings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    dramaId: uuid("drama_id")
      .notNull()
      .references(() => dramas.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dramaId] })]
);
```

**Step 2: `ops.ts`**

```ts
import { pgTable, uuid, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { dramas, episodes } from "./catalog";

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: uuid("reporter_id").references(() => profiles.id),
  targetType: text("target_type", { enum: ["drama", "episode", "payment", "subtitle", "other"] }).notNull(),
  targetId: uuid("target_id"),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["open", "in_progress", "resolved", "rejected"] }).notNull().default("open"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const syncLogs = pgTable("sync_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id"),
  jobType: text("job_type").notNull(),
  triggerType: text("trigger_type", { enum: ["cron", "manual"] }).notNull(),
  status: text("status", { enum: ["success", "partial", "failed", "running"] }).notNull(),
  dramaNew: integer("drama_new").notNull().default(0),
  dramaUpdated: integer("drama_updated").notNull().default(0),
  episodeNew: integer("episode_new").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errorDetail: text("error_detail"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const providerHealth = pgTable("provider_health", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id"),
  status: text("status", { enum: ["healthy", "degraded", "down"] }).notNull(),
  latencyMs: integer("latency_ms"),
  errorRate: integer("error_rate"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  event: text("event").notNull(),
  properties: jsonb("properties").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => profiles.id),
  action: text("action").notNull(),
  target: text("target"),
  detail: jsonb("detail").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const editorialCollections = pgTable("editorial_collections", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  kind: text("kind", { enum: ["banner", "collection", "promo"] }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**Step 3: Generate migration and commit**

```bash
pnpm --filter @dramaplay/db db:generate
git add packages/db
git commit -m "feat(db): add engagement and ops schema"
```

---

## Task 2.7: Schema barrel + db client

**Files:**
- Create: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`

**Step 1: `schema/index.ts`**

```ts
export * from "./users";
export * from "./catalog";
export * from "./media";
export * from "./billing";
export * from "./engagement";
export * from "./ops";
```

**Step 2: `client.ts`**

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

export function createDb(url: string) {
  const client = postgres(url, { max: 5 });
  return drizzle(client, { schema });
}
```

**Step 3: `index.ts`**

```ts
export * from "./schema";
export * from "./client";
```

**Step 4: Commit**

```bash
git add packages/db
git commit -m "feat(db): export schema and db client"
```

---

## Task 2.8: Apply migration to local Supabase (verification)

**Step 1: Create `.env`**

```bash
cp .env.example .env
# fill DATABASE_URL with local Supabase postgres connection string
```

**Step 2: Run migrate**

```bash
DATABASE_URL=$DATABASE_URL pnpm --filter @dramaplay/db db:migrate
```

Expected: all migrations applied, no errors.

**Step 3: Commit `.env.example`**

Create `.env.example`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

```bash
git add .env.example
git commit -m "chore: add env example"
```

---

# Phase 3: Supabase Auth Foundation

## Task 3.1: Configure Supabase project and seed plans

**Files:**
- Create: `packages/db/src/seed.ts`

**Step 1: Write seed**

```ts
import { createDb } from "./client";
import { plans } from "./schema";

const db = createDb(process.env.DATABASE_URL!);

await db
  .insert(plans)
  .values([
    { code: "vip_weekly", name: "VIP Mingguan", durationDays: 7, priceIdr: 15000 },
    { code: "vip_monthly", name: "VIP Bulanan", durationDays: 30, priceIdr: 49000 },
  ])
  .onConflictDoNothing({ target: plans.code });

await db.$client.end();
```

**Step 2: Add seed script**

Update `packages/db/package.json`:

```json
"db:seed": "tsx src/seed.ts"
```

Install `tsx`:

```bash
pnpm --filter @dramaplay/db add -D tsx
```

**Step 3: Run seed**

```bash
DATABASE_URL=$DATABASE_URL pnpm --filter @dramaplay/db db:seed
```

Expected: 2 rows in `plans`.

**Step 4: Commit**

```bash
git add packages/db
git commit -m "feat(db): seed vip plans"
```

---

## Task 3.2: Configure Supabase Auth providers

**Manual step in Supabase dashboard:**

- Enable Email/Password auth.
- Enable Google OAuth (configure client ID/secret).
- Set site URL to `http://localhost:5173` for dev.
- Configure redirect URLs:
  - `http://localhost:5173/auth/callback`
  - `https://dramaplay.id/auth/callback`

**Step 1: Document in `docs/setup/supabase-auth.md`**

Create file describing the steps above.

**Step 2: Commit**

```bash
git add docs/setup/supabase-auth.md
git commit -m "docs: supabase auth setup"
```

---

## Task 3.3: Profile auto-provision trigger

**Files:**
- Create: `packages/db/supabase/profiles-trigger.sql`

**Step 1: Write SQL trigger**

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Step 2: Apply to Supabase SQL editor**

**Step 3: Commit**

```bash
git add packages/db/supabase/profiles-trigger.sql
git commit -m "feat(db): auto-provision profile on signup"
```

---

# Phase 4: Cloudflare Workers API Foundation

## Task 4.1: Scaffold `apps/api`

**Step 1: Create directory and package.json**

`apps/api/package.json`:

```json
{
  "name": "@dramaplay/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@dramaplay/db": "workspace:*",
    "@dramaplay/shared": "workspace:*",
    "hono": "^4.6.5",
    "@supabase/supabase-js": "^2.45.4"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241011.0",
    "wrangler": "^3.80.0",
    "vitest": "^2.1.3"
  }
}
```

**Step 2: Install**

```bash
pnpm install
```

**Step 3: Commit**

```bash
git add apps/api
git commit -m "feat(api): scaffold workers package"
```

---

## Task 4.2: Wrangler config + types

**Files:**
- Create: `apps/api/wrangler.toml`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/.dev.vars.example`

**Step 1: `wrangler.toml`**

```toml
name = "dramaplay-api"
compatibility_date = "2024-10-01"
main = "src/index.ts"

[vars]
ENVIRONMENT = "development"

[[triggers.crons]]
crons = ["*/30 * * * *", "0 */2 * * *"]
```

**Step 2: `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src"]
}
```

**Step 3: `.dev.vars.example`**

```ini
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PAKASIR_API_KEY=
PAKASIR_WEBHOOK_SECRET=
```

**Step 4: Commit**

```bash
git add apps/api/wrangler.toml apps/api/tsconfig.json apps/api/.dev.vars.example
git commit -m "feat(api): add wrangler config"
```

---

## Task 4.3: Hono entry with health check

**Files:**
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/env.ts`

**Step 1: `env.ts`**

```ts
export interface Env {
  ENVIRONMENT: string;
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PAKASIR_API_KEY: string;
  PAKASIR_WEBHOOK_SECRET: string;
}
```

**Step 2: `index.ts`**

```ts
import { Hono } from "hono";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true, name: "dramaplay-api" }));

export default app;
```

**Step 3: Verify**

```bash
pnpm --filter @dramaplay/api dev
curl http://localhost:8787/health
```

Expected: `{"ok":true,"name":"dramaplay-api"}`

**Step 4: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): hono app with health endpoint"
```

---

## Task 4.4: Auth middleware (Supabase JWT)

**Files:**
- Create: `apps/api/src/middleware/auth.ts`

**Step 1: Write middleware**

```ts
import { createClient } from "@supabase/supabase-js";
import { createMiddleware } from "hono/factory";
import type { Env } from "../env";

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: { user: { id: string } } }>(
  async (c, next) => {
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
  }
);
```

**Step 2: Commit**

```bash
git add apps/api/src/middleware
git commit -m "feat(api): supabase auth middleware"
```

---

## Task 4.5: Admin role middleware

**Files:**
- Create: `apps/api/src/middleware/admin.ts`

**Step 1: Write middleware**

```ts
import { createMiddleware } from "hono/factory";
import { createDb } from "@dramaplay/db";
import { profiles } from "@dramaplay/db";
import { eq } from "drizzle-orm";
import type { Env } from "../env";

const ADMIN_ROLES = ["super_admin", "editor", "moderator", "finance", "support"];

export const adminMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { user: { id: string }; adminRole: string };
}>(async (c, next) => {
  const userId = c.get("user")?.id;
  if (!userId) return c.json({ error: "unauthorized" }, 401);

  const db = createDb(c.env.DATABASE_URL);
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId));
  if (!profile || profile.isBanned) return c.json({ error: "forbidden" }, 403);
  if (!ADMIN_ROLES.includes(profile.role)) return c.json({ error: "forbidden" }, 403);

  c.set("adminRole", profile.role);
  await next();
});
```

**Step 2: Commit**

```bash
git add apps/api/src/middleware
git commit -m "feat(api): admin role middleware"
```

---

# Phase 5: Provider Adapter Layer

## Task 5.1: Adapter interface and types

**Files:**
- Create: `packages/shared/src/provider/types.ts`

**Step 1: Write types**

```ts
export interface ProviderDramaSummary {
  providerDramaId: string;
  title: string;
  posterUrl?: string;
  backdropUrl?: string;
  genres?: string[];
  country?: string;
  year?: number;
}

export interface ProviderDramaDetail extends ProviderDramaSummary {
  originalTitle?: string;
  synopsis?: string;
  language?: string;
  tags?: string[];
  episodeCount?: number;
  episodes?: ProviderEpisodeSummary[];
}

export interface ProviderEpisodeSummary {
  providerEpisodeId: string;
  episodeNumber: number;
  title?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}

export interface ProviderStreamSource {
  streamUrl: string;
  streamType: "mp4" | "m3u8" | "other";
  quality?: string;
  subtitleUrl?: string;
  subtitleLanguage?: string;
  expiresAt?: Date;
}

export interface ProviderAdapter {
  code: string;
  fetchForYou(cursor?: string): Promise<{ items: ProviderDramaSummary[]; nextCursor?: string }>;
  fetchTrending(): Promise<ProviderDramaSummary[]>;
  fetchLatest(): Promise<ProviderDramaSummary[]>;
  fetchVip(): Promise<ProviderDramaSummary[]>;
  search(query: string): Promise<ProviderDramaSummary[]>;
  fetchDetail(providerDramaId: string): Promise<ProviderDramaDetail | null>;
  fetchEpisodes(providerDramaId: string): Promise<ProviderEpisodeSummary[]>;
  resolveStream(providerEpisodeId: string): Promise<ProviderStreamSource | null>;
}
```

**Step 2: Export from index**

Update `packages/shared/src/index.ts`:

```ts
export * from "./provider/types";
export const DRAMAPLAY_APP_NAME = "Dramaplay";
```

**Step 3: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): provider adapter types"
```

---

## Task 5.2: Base HTTP adapter helper

**Files:**
- Create: `apps/api/src/providers/base.ts`

**Step 1: Write helper**

```ts
import type { ProviderAdapter } from "@dramaplay/shared";

export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract code: string;
  protected baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  protected async getJson<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`${this.code}: ${res.status}`);
    return res.json() as Promise<T>;
  }

  abstract fetchForYou(cursor?: string): Promise<{ items: import("@dramaplay/shared").ProviderDramaSummary[]; nextCursor?: string }>;
  abstract fetchTrending(): Promise<import("@dramaplay/shared").ProviderDramaSummary[]>;
  abstract fetchLatest(): Promise<import("@dramaplay/shared").ProviderDramaSummary[]>;
  abstract fetchVip(): Promise<import("@dramaplay/shared").ProviderDramaSummary[]>;
  abstract search(query: string): Promise<import("@dramaplay/shared").ProviderDramaSummary[]>;
  abstract fetchDetail(providerDramaId: string): Promise<import("@dramaplay/shared").ProviderDramaDetail | null>;
  abstract fetchEpisodes(providerDramaId: string): Promise<import("@dramaplay/shared").ProviderEpisodeSummary[]>;
  abstract resolveStream(providerEpisodeId: string): Promise<import("@dramaplay/shared").ProviderStreamSource | null>;
}
```

**Step 2: Commit**

```bash
git add apps/api/src/providers
git commit -m "feat(api): base provider adapter"
```

---

## Task 5.3: Stub provider adapters

**Files:**
- Create: `apps/api/src/providers/dramabox.ts`
- Create: `apps/api/src/providers/reelshort.ts`
- Create: `apps/api/src/providers/shortmax.ts`

**Step 1: Create `dramabox.ts`** (other two follow same pattern with different `code`)

```ts
import type { ProviderAdapter, ProviderDramaDetail, ProviderDramaSummary, ProviderEpisodeSummary, ProviderStreamSource } from "@dramaplay/shared";
import { BaseProviderAdapter } from "./base";

export class DramaBoxAdapter extends BaseProviderAdapter {
  code = "dramabox";

  async fetchForYou(cursor?: string): Promise<{ items: ProviderDramaSummary[]; nextCursor?: string }> {
    const data = await this.getJson<{ data: ProviderDramaSummary[]; cursor?: string }>(`/dramabox/foryou${cursor ? `?cursor=${cursor}` : ""}`);
    return { items: data.data ?? [], nextCursor: data.cursor };
  }
  async fetchTrending() {
    const data = await this.getJson<{ data: ProviderDramaSummary[] }>(`/dramabox/trending`);
    return data.data ?? [];
  }
  async fetchLatest() {
    const data = await this.getJson<{ data: ProviderDramaSummary[] }>(`/dramabox/latest`);
    return data.data ?? [];
  }
  async fetchVip() {
    const data = await this.getJson<{ data: ProviderDramaSummary[] }>(`/dramabox/vip`);
    return data.data ?? [];
  }
  async search(query: string) {
    const data = await this.getJson<{ data: ProviderDramaSummary[] }>(`/dramabox/search?q=${encodeURIComponent(query)}`);
    return data.data ?? [];
  }
  async fetchDetail(id: string) {
    return this.getJson<ProviderDramaDetail | null>(`/dramabox/detail?id=${encodeURIComponent(id)}`);
  }
  async fetchEpisodes(id: string) {
    const data = await this.getJson<{ data: ProviderEpisodeSummary[] }>(`/dramabox/allepisode?id=${encodeURIComponent(id)}`);
    return data.data ?? [];
  }
  async resolveStream(episodeId: string) {
    return this.getJson<ProviderStreamSource | null>(`/dramabox/episode?id=${encodeURIComponent(episodeId)}`);
  }
}
```

**Step 2: Replicate for `reelshort.ts` (code = "reelshort", paths `/reelshort/*`) and `shortmax.ts` (code = "shortmax", paths `/shortmax/*`).**

**Step 3: Commit**

```bash
git add apps/api/src/providers
git commit -m "feat(api): add dramabox, reelshort, shortmax adapters"
```

---

## Task 5.4: Provider registry

**Files:**
- Create: `apps/api/src/providers/registry.ts`

**Step 1: Write registry**

```ts
import type { ProviderAdapter } from "@dramaplay/shared";
import { DramaBoxAdapter } from "./dramabox";
import { ReelShortAdapter } from "./reelshort";
import { ShortMaxAdapter } from "./shortmax";

export function buildProviders(baseUrl: string): Record<string, ProviderAdapter> {
  return {
    dramabox: new DramaBoxAdapter(baseUrl),
    reelshort: new ReelShortAdapter(baseUrl),
    shortmax: new ShortMaxAdapter(baseUrl),
  };
}
```

**Step 2: Commit**

```bash
git add apps/api/src/providers
git commit -m "feat(api): provider registry"
```

---

## Task 5.5: Catalog API routes (listing, detail, episodes)

**Files:**
- Create: `apps/api/src/routes/catalog.ts`

**Step 1: Write routes**

```ts
import { Hono } from "hono";
import { createDb } from "@dramaplay/db";
import { dramas, episodes } from "@dramaplay/db";
import { eq, desc, sql } from "drizzle-orm";
import type { Env } from "../env";

export const catalog = new Hono<{ Bindings: Env }>();

catalog.get("/trending", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db
    .select()
    .from(dramas)
    .where(sql`${dramas.isPublished} = true and ${dramas.visibility} = 'public'`)
    .orderBy(desc(dramas.popularityScore))
    .limit(20);
  return c.json({ items: rows });
});

catalog.get("/new", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(dramas).orderBy(desc(dramas.createdAt)).limit(20);
  return c.json({ items: rows });
});

catalog.get("/dramas/:slug", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const [drama] = await db.select().from(dramas).where(eq(dramas.slug, c.req.param("slug")));
  if (!drama) return c.json({ error: "not_found" }, 404);
  const eps = await db.select().from(episodes).where(eq(episodes.dramaId, drama.id)).orderBy(episodes.episodeNumber);
  return c.json({ drama, episodes: eps });
});

catalog.get("/search", async (c) => {
  const q = c.req.query("q") ?? "";
  if (!q) return c.json({ items: [] });
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db
    .select()
    .from(dramas)
    .where(sql`${dramas.title} ilike ${"%" + q + "%"}`)
    .limit(20);
  return c.json({ items: rows });
});
```

**Step 2: Mount in `index.ts`**

Update `apps/api/src/index.ts`:

```ts
import { Hono } from "hono";
import type { Env } from "./env";
import { catalog } from "./routes/catalog";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true, name: "dramaplay-api" }));
app.route("/catalog", catalog);

export default app;
```

**Step 3: Verify**

```bash
pnpm --filter @dramaplay/api dev
curl http://localhost:8787/catalog/trending
```

Expected: `{"items":[]}`

**Step 4: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): catalog routes (trending, new, detail, search)"
```

---

# Phase 6: Consumer PWA Foundation

## Task 6.1: Scaffold Vite + React app

**Step 1: Create `apps/consumer`**

```bash
pnpm create vite apps/consumer --template react-ts
```

**Step 2: Edit `apps/consumer/package.json` name**

```json
{
  "name": "@dramaplay/consumer",
  "private": true,
  "version": "0.0.0",
  "type": "module"
}
```

**Step 3: Commit**

```bash
git add apps/consumer
git commit -m "feat(consumer): scaffold vite react"
```

---

## Task 6.2: Install Tailwind, PWA plugin, router, supabase

```bash
pnpm --filter @dramaplay/consumer add -D tailwindcss@^3.4.14 postcss autoprefixer vite-plugin-pwa
pnpm --filter @dramaplay/consumer add @supabase/supabase-js react-router-dom @tanstack/react-query
```

**Step 1: Tailwind init**

```bash
pnpm --filter @dramaplay/consumer exec tailwindcss init -p
```

`tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

`src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 2: Commit**

```bash
git add apps/consumer
git commit -m "feat(consumer): add tailwind, pwa, router, supabase, react-query"
```

---

## Task 6.3: API client + Supabase client

**Files:**
- Create: `apps/consumer/src/lib/api.ts`
- Create: `apps/consumer/src/lib/supabase.ts`

**Step 1: `api.ts`**

```ts
const BASE = import.meta.env.VITE_API_URL ?? "";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}
```

**Step 2: `supabase.ts`**

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

**Step 3: Commit**

```bash
git add apps/consumer/src/lib
git commit -m "feat(consumer): api and supabase clients"
```

---

## Task 6.4: Router + layout skeleton

**Files:**
- Create: `apps/consumer/src/App.tsx`
- Create: `apps/consumer/src/pages/Home.tsx`
- Create: `apps/consumer/src/pages/DramaDetail.tsx`
- Create: `apps/consumer/src/pages/Watch.tsx`
- Create: `apps/consumer/src/pages/Auth.tsx`
- Create: `apps/consumer/src/pages/Profile.tsx`

**Step 1: `App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "./pages/Home";
import DramaDetail from "./pages/DramaDetail";
import Watch from "./pages/Watch";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";

const qc = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/drama/:slug" element={<DramaDetail />} />
          <Route path="/drama/:slug/episode/:n" element={<Watch />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

**Step 2: Each page stub exports a minimal component with the page name as heading.**

**Step 3: Commit**

```bash
git add apps/consumer/src
git commit -m "feat(consumer): router and page skeletons"
```

---

## Task 6.5: PWA manifest + Vite config

**Files:**
- Modify: `apps/consumer/vite.config.ts`
- Create: `apps/consumer/public/manifest.webmanifest`
- Create: `apps/consumer/public/icons/.gitkeep`

**Step 1: `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [react(), VitePWA({ registerType: "autoUpdate", includeAssets: ["manifest.webmanifest"] })],
});
```

**Step 2: `manifest.webmanifest`**

```json
{
  "name": "Dramaplay",
  "short_name": "Dramaplay",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "orientation": "portrait",
  "icons": []
}
```

**Step 3: Commit**

```bash
git add apps/consumer
git commit -m "feat(consumer): pwa manifest and vite config"
```

---

# Phase 7: Video Player + Playback

## Task 7.1: Install Video.js + HLS.js

```bash
pnpm --filter @dramaplay/consumer add video.js videojs-contrib-quality-levels
pnpm --filter @dramaplay/consumer add HLS.js 2>/dev/null || pnpm --filter @dramaplay/consumer add hls.js
```

**Step 1: Commit**

```bash
git add apps/consumer
git commit -m "feat(consumer): add video.js and hls.js"
```

---

## Task 7.2: VerticalShortPlayer component

**Files:**
- Create: `apps/consumer/src/components/VerticalShortPlayer.tsx`

**Step 1: Write component**

```tsx
import { useEffect, useRef } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import type Player from "video.js/dist/types/player";

interface Props {
  source: { streamUrl: string; streamType: "mp4" | "m3u8" | "other" };
  poster?: string;
  subtitleUrl?: string;
  onEnded?: () => void;
  onTimeUpdate?: (sec: number) => void;
}

export default function VerticalShortPlayer({ source, poster, subtitleUrl, onEnded, onTimeUpdate }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    playerRef.current = videojs(ref.current, {
      controls: true,
      fluid: true,
      poster,
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
    });

    if (source.streamType === "m3u8") {
      playerRef.current.src({ src: source.streamUrl, type: "application/x-mpegURL" });
    } else if (source.streamType === "mp4") {
      playerRef.current.src({ src: source.streamUrl, type: "video/mp4" });
    }

    if (subtitleUrl) playerRef.current.addRemoteTextTrack({ src: subtitleUrl, kind: "subtitles", srclang: "id", label: "Indonesia", default: true }, false);

    playerRef.current.on("ended", () => onEnded?.());
    playerRef.current.on("timeupdate", () => onTimeUpdate?.(playerRef.current?.currentTime() ?? 0));

    return () => playerRef.current?.dispose();
  }, [source.streamUrl, source.streamType, subtitleUrl]);

  return (
    <div className="aspect-[9/16] bg-black">
      <div data-vjs-player>
        <video ref={ref} className="video-js vjs-big-play-centered h-full w-full" playsInline />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/consumer/src/components
git commit -m "feat(consumer): vertical short drama player"
```

---

## Task 7.3: Watch page integration

**Files:**
- Modify: `apps/consumer/src/pages/Watch.tsx`

**Step 1: Implement page**

```tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import VerticalShortPlayer from "../components/VerticalShortPlayer";

interface StreamResponse {
  streamUrl: string;
  streamType: "mp4" | "m3u8" | "other";
  subtitleUrl?: string;
  posterUrl?: string;
  episodeNumber: number;
  nextEpisodeNumber?: number;
  accessType: "free" | "vip";
}

export default function Watch() {
  const { slug, n } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<StreamResponse | null>(null);

  useEffect(() => {
    api<StreamResponse>(`/watch/${slug}/${n}`).then(setData).catch(console.error);
  }, [slug, n]);

  if (!data) return <div className="p-4 text-white">Memuat...</div>;
  if (data.accessType === "vip") return <Paywall />;

  return (
    <div className="min-h-screen bg-black">
      <VerticalShortPlayer
        source={{ streamUrl: data.streamUrl, streamType: data.streamType }}
        poster={data.posterUrl}
        subtitleUrl={data.subtitleUrl}
        onEnded={() => data.nextEpisodeNumber && navigate(`/drama/${slug}/episode/${data.nextEpisodeNumber}`)}
      />
    </div>
  );
}

function Paywall() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-white">
      <h1 className="text-xl font-bold">Episode VIP</h1>
      <p className="text-sm text-slate-300">Berlangganan VIP untuk menonton episode ini.</p>
      <button className="rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-black">Langganan VIP</button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/consumer/src/pages/Watch.tsx
git commit -m "feat(consumer): watch page with player and paywall"
```

---

## Task 7.4: Watch resolve API route

**Files:**
- Create: `apps/api/src/routes/watch.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Route**

```ts
import { Hono } from "hono";
import { createDb } from "@dramaplay/db";
import { dramas, episodes, subtitles, episodeProviders } from "@dramaplay/db";
import { and, eq } from "drizzle-orm";
import type { Env } from "../env";
import { authMiddleware } from "../middleware/auth";
import { buildProviders } from "../providers/registry";

export const watch = new Hono<{ Bindings: Env }>();

watch.get("/:slug/:n", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const [drama] = await db.select().from(dramas).where(eq(dramas.slug, c.req.param("slug")));
  if (!drama) return c.json({ error: "not_found" }, 404);

  const n = Number(c.req.param("n"));
  const [episode] = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.dramaId, drama.id), eq(episodes.episodeNumber, n)));
  if (!episode) return c.json({ error: "not_found" }, 404);

  // VIP entitlement check (simplified): if episode.vip, require auth + active subscription
  if (episode.accessType === "vip") {
    // delegate to authenticated variant
    return c.json({ accessType: "vip", episodeNumber: episode.episodeNumber }, 403);
  }

  const [primary] = await db.select().from(episodeProviders).where(eq(episodeProviders.episodeId, episode.id));
  const providers = buildProviders(c.env.PROVIDER_BASE_URL ?? "https://api.example.com");
  const provider = primary ? providers[primary.providerId] ?? Object.values(providers)[0] : Object.values(providers)[0];

  const source = primary && provider ? await provider.resolveStream(primary.providerEpisodeId) : null;
  const [sub] = await db
    .select()
    .from(subtitles)
    .where(and(eq(subtitles.episodeId, episode.id), eq(subtitles.language, "id"), eq(subtitles.isEnabled, true)))
    .limit(1);

  return c.json({
    streamUrl: source?.streamUrl ?? "",
    streamType: source?.streamType ?? "mp4",
    subtitleUrl: sub?.url ?? undefined,
    posterUrl: drama.backdropUrl ?? drama.posterUrl ?? undefined,
    episodeNumber: episode.episodeNumber,
    accessType: episode.accessType,
  });
});
```

**Step 2: Mount**

Update `apps/api/src/index.ts` to add `app.route("/watch", watch);` and import.

**Step 3: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): watch resolve route"
```

---

# Phase 8: VIP Subscription + Pakasir

## Task 8.1: VIP entitlement helper

**Files:**
- Create: `apps/api/src/lib/entitlements.ts`

**Step 1: Write helper**

```ts
import { createDb } from "@dramaplay/db";
import { subscriptions } from "@dramaplay/db";
import { and, eq, gt } from "drizzle-orm";

export async function isUserVip(dbUrl: string, userId: string): Promise<boolean> {
  const db = createDb(dbUrl);
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"), gt(subscriptions.expiresAt, new Date())))
    .limit(1);
  return Boolean(sub);
}
```

**Step 2: Commit**

```bash
git add apps/api/src/lib
git commit -m "feat(api): vip entitlement helper"
```

---

## Task 8.2: Plans + checkout route

**Files:**
- Create: `apps/api/src/routes/billing.ts`

**Step 1: Write routes**

```ts
import { Hono } from "hono";
import { createDb } from "@dramaplay/db";
import { plans, payments } from "@dramaplay/db";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import { authMiddleware } from "../middleware/auth";

export const billing = new Hono<{ Bindings: Env }>();

billing.get("/plans", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(plans).where(eq(plans.isEnabled, true));
  return c.json({ items: rows });
});

billing.post("/checkout", authMiddleware, async (c) => {
  const userId = c.get("user").id;
  const { planCode } = await c.req.json<{ planCode: string }>();

  const db = createDb(c.env.DATABASE_URL);
  const [plan] = await db.select().from(plans).where(eq(plans.code, planCode));
  if (!plan) return c.json({ error: "plan_not_found" }, 404);

  const [payment] = await db
    .insert(payments)
    .values({ userId, planId: plan.id, amountIdr: plan.priceIdr, status: "pending" })
    .returning();

  // TODO: create Pakasir transaction and store reference
  const checkoutUrl = `https://pakasir.example.com/checkout?ref=${payment.id}`;

  return c.json({ paymentId: payment.id, checkoutUrl });
});
```

**Step 2: Mount**

Add `app.route("/billing", billing)` in `index.ts`.

**Step 3: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): billing plans and checkout"
```

---

## Task 8.3: Pakasir webhook handler

**Files:**
- Create: `apps/api/src/routes/pakasir.ts`

**Step 1: Write handler**

```ts
import { Hono } from "hono";
import { createDb } from "@dramaplay/db";
import { payments, subscriptions, plans } from "@dramaplay/db";
import { eq } from "drizzle-orm";
import type { Env } from "../env";

export const pakasir = new Hono<{ Bindings: Env }>();

pakasir.post("/webhook", async (c) => {
  const signature = c.req.header("x-pakasir-signature") ?? "";
  if (signature !== c.env.PAKASIR_WEBHOOK_SECRET) return c.json({ error: "invalid_signature" }, 401);

  const body = await c.req.json<{
    reference: string;
    status: "paid" | "failed" | "expired";
    pakasirTransactionId: string;
  }>();

  const db = createDb(c.env.DATABASE_URL);
  const [payment] = await db.select().from(payments).where(eq(payments.id, body.reference));
  if (!payment) return c.json({ error: "not_found" }, 404);

  if (body.status === "paid") {
    await db
      .update(payments)
      .set({ status: "paid", pakasirTransactionId: body.pakasirTransactionId, paidAt: new Date() })
      .where(eq(payments.id, payment.id));

    const [plan] = await db.select().from(plans).where(eq(plans.id, payment.planId));
    if (plan) {
      const now = new Date();
      const expires = new Date(now.getTime() + plan.durationDays * 86400000);
      await db.insert(subscriptions).values({
        userId: payment.userId,
        planId: plan.id,
        status: "active",
        startedAt: now,
        expiresAt: expires,
      });
    }
    return c.json({ ok: true });
  }

  await db.update(payments).set({ status: body.status }).where(eq(payments.id, payment.id));
  return c.json({ ok: true });
});
```

**Step 2: Mount**

Add `app.route("/pakasir", pakasir)`.

**Step 3: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): pakasir webhook handler"
```

---

## Task 8.4: VIP-gated watch route variant

**Files:**
- Modify: `apps/api/src/routes/watch.ts`

**Step 1: Update** to use `authMiddleware` when `accessType === "vip"`:

After the `if (episode.accessType === "vip")` block, replace with a check that requires `authMiddleware` semantics — implement via a manual user lookup using the same logic, then use `isUserVip`. If not VIP, return `accessType: "vip"` with 403.

**Step 2: Commit**

```bash
git add apps/api/src/routes/watch.ts
git commit -m "feat(api): enforce vip access on watch route"
```

---

## Task 8.5: Consumer pricing modal

**Files:**
- Create: `apps/consumer/src/components/PricingModal.tsx`
- Modify: `apps/consumer/src/pages/Watch.tsx`

**Step 1: Component**

```tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";

interface Plan {
  id: string;
  code: string;
  name: string;
  durationDays: number;
  priceIdr: number;
}

export default function PricingModal({ onClose }: { onClose: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    api<{ items: Plan[] }>("/billing/plans").then((r) => setPlans(r.items));
  }, []);

  async function subscribe(code: string) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await api<{ checkoutUrl: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ planCode: code }),
      headers: { Authorization: `Bearer ${token}` },
    });
    window.location.href = res.checkoutUrl;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 p-5 text-white">
        <h2 className="mb-3 text-lg font-bold">Pilih Paket VIP</h2>
        {plans.map((p) => (
          <button
            key={p.code}
            onClick={() => subscribe(p.code)}
            className="mb-2 w-full rounded-xl bg-yellow-500 p-3 text-left text-black"
          >
            <div className="font-bold">{p.name}</div>
            <div className="text-sm">Rp {p.priceIdr.toLocaleString("id-ID")}</div>
          </button>
        ))}
        <button onClick={onClose} className="mt-2 w-full text-sm text-slate-300">
          Tutup
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Wire into `Watch.tsx` Paywall** to open `PricingModal`.

**Step 3: Commit**

```bash
git add apps/consumer/src
git commit -m "feat(consumer): pricing modal and vip checkout flow"
```

---

# Phase 9: Admin Panel Foundation

## Task 9.1: Scaffold admin app

```bash
pnpm create vite apps/admin --template react-ts
```

Edit `apps/admin/package.json` name to `@dramaplay/admin`.

**Step 1: Install Tailwind, router, tanstack-table**

```bash
pnpm --filter @dramaplay/consumer add react-router-dom @tanstack/react-query @tanstack/react-table
pnpm --filter @dramaplay/admin add -D tailwindcss postcss autoprefixer
```

**Step 2: Tailwind init**

```bash
pnpm --filter @dramaplay/admin exec tailwindcss init -p
```

**Step 3: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): scaffold vite react admin"
```

---

## Task 9.2: Admin auth gate + layout

**Files:**
- Create: `apps/admin/src/App.tsx`
- Create: `apps/admin/src/components/Layout.tsx`

**Step 1: `App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Providers from "./pages/Providers";
import Dramas from "./pages/Dramas";
import Users from "./pages/Users";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/dramas" element={<Dramas />} />
          <Route path="/users" element={<Users />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 2: Each page stub** with heading.

**Step 3: Commit**

```bash
git add apps/admin/src
git commit -m "feat(admin): router and layout"
```

---

## Task 9.3: Admin providers page (list + enable/disable)

**Files:**
- Create: `apps/admin/src/pages/Providers.tsx`

**Step 1: Implement basic list**

```tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Provider {
  id: string;
  code: string;
  name: string;
  isEnabled: boolean;
  lastSyncStatus: string;
}

export default function Providers() {
  const [rows, setRows] = useState<Provider[]>([]);
  useEffect(() => {
    api<{ items: Provider[] }>("/admin/providers").then((r) => setRows(r.items));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Providers</h1>
      <table className="mt-4 w-full text-sm">
        <thead><tr><th className="text-left">Code</th><th>Name</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t">
              <td>{p.code}</td>
              <td>{p.name}</td>
              <td>{p.isEnabled ? "Enabled" : "Disabled"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/admin/src/pages/Providers.tsx
git commit -m "feat(admin): providers list page"
```

---

## Task 9.4: Admin API routes (providers, dramas, users, payments, reports)

**Files:**
- Create: `apps/api/src/routes/admin.ts`

**Step 1: Routes**

```ts
import { Hono } from "hono";
import { createDb } from "@dramaplay/db";
import { providers, dramas, profiles, payments, reports } from "@dramaplay/db";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import { authMiddleware } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";

export const admin = new Hono<{ Bindings: Env }>();
admin.use("*", authMiddleware, adminMiddleware);

admin.get("/providers", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(providers);
  return c.json({ items: rows });
});

admin.get("/dramas", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(dramas).limit(50);
  return c.json({ items: rows });
});

admin.get("/users", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(profiles).limit(50);
  return c.json({ items: rows });
});

admin.get("/payments", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(payments).limit(50);
  return c.json({ items: rows });
});

admin.get("/reports", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(reports).limit(50);
  return c.json({ items: rows });
});

admin.post("/providers/:id/toggle", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const [row] = await db.select().from(providers).where(eq(providers.id, c.req.param("id")));
  if (!row) return c.json({ error: "not_found" }, 404);
  await db.update(providers).set({ isEnabled: !row.isEnabled }).where(eq(providers.id, row.id));
  return c.json({ ok: true });
});
```

**Step 2: Mount** `app.route("/admin", admin)`.

**Step 3: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): admin routes"
```

---

# Phase 10: Sync Scheduler + Provider Health

## Task 10.1: Sync service

**Files:**
- Create: `apps/api/src/sync/sync.ts`

**Step 1: Write sync runner**

```ts
import { createDb } from "@dramaplay/db";
import { providers, dramas, dramaProviders, episodes, episodeProviders, syncLogs } from "@dramaplay/db";
import { eq } from "drizzle-orm";
import { buildProviders } from "../providers/registry";
import { slugifyTitle } from "../lib/slug";

export async function syncProvider(dbUrl: string, providerCode: string, providerBaseUrl: string) {
  const db = createDb(dbUrl);
  const adapters = buildProviders(providerBaseUrl);
  const adapter = adapters[providerCode];
  if (!adapter) throw new Error(`unknown provider ${providerCode}`);

  const startedAt = new Date();
  let dramaNew = 0;
  let dramaUpdated = 0;
  let episodeNew = 0;
  let errorCount = 0;

  try {
    const [providerRow] = await db.select().from(providers).where(eq(providers.code, providerCode));
    if (!providerRow) throw new Error("provider not registered");

    const items = await adapter.fetchLatest();
    for (const item of items) {
      try {
        const [existing] = await db
          .select()
          .from(dramas)
          .where(eq(dramas.slug, slugifyTitle(item.title)));
        const [drama] = existing
          ? await db
              .update(dramas)
              .set({ title: item.title, posterUrl: item.posterUrl, updatedAt: new Date() })
              .where(eq(dramas.id, existing.id))
              .returning()
          : await db
              .insert(dramas)
              .values({
                slug: slugifyTitle(item.title),
                title: item.title,
                posterUrl: item.posterUrl,
                genres: item.genres ?? [],
                country: item.country,
                year: item.year,
              })
              .returning();
        if (existing) dramaUpdated++;
        else dramaNew++;

        await db
          .insert(dramaProviders)
          .values({ dramaId: drama.id, providerId: providerRow.id, providerDramaId: item.providerDramaId, isPrimary: true })
          .onConflictDoNothing();

        const eps = await adapter.fetchEpisodes(item.providerDramaId);
        for (const ep of eps) {
          const [existingEp] = await db
            .select()
            .from(episodes)
            .where(eq(episodes.dramaId, drama.id));
          // simple upsert by (dramaId, episodeNumber) — assume unique
          if (!existingEp) {
            const [created] = await db
              .insert(episodes)
              .values({ dramaId: drama.id, episodeNumber: ep.episodeNumber, title: ep.title, thumbnailUrl: ep.thumbnailUrl, durationSeconds: ep.durationSeconds })
              .returning();
            await db
              .insert(episodeProviders)
              .values({ episodeId: created.id, providerId: providerRow.id, providerEpisodeId: ep.providerEpisodeId, isPrimary: true })
              .onConflictDoNothing();
            episodeNew++;
          }
        }
      } catch {
        errorCount++;
      }
    }

    await db.update(providers).set({ lastSyncAt: new Date(), lastSyncStatus: "success" }).where(eq(providers.id, providerRow.id));
    await db.insert(syncLogs).values({
      providerId: providerRow.id,
      jobType: "latest",
      triggerType: "cron",
      status: errorCount === 0 ? "success" : "partial",
      dramaNew,
      dramaUpdated,
      episodeNew,
      errorCount,
      startedAt,
      finishedAt: new Date(),
    });
  } catch (e) {
    errorCount++;
    await db.insert(syncLogs).values({
      jobType: "latest",
      triggerType: "cron",
      status: "failed",
      dramaNew,
      dramaUpdated,
      episodeNew,
      errorCount,
      errorDetail: String(e),
      startedAt,
      finishedAt: new Date(),
    });
    throw e;
  }
}
```

**Step 2: Commit**

```bash
git add apps/api/src/sync
git commit -m "feat(api): provider sync runner"
```

---

## Task 10.2: Slug helper

**Files:**
- Create: `apps/api/src/lib/slug.ts`

```ts
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 100);
}
```

**Step 1: Commit**

```bash
git add apps/api/src/lib/slug.ts
git commit -m "feat(api): slugify helper"
```

---

## Task 10.3: Scheduled cron handler

**Files:**
- Modify: `apps/api/src/index.ts`

**Step 1: Add `scheduled` handler**

```ts
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env) {
    const providers = await createDb(env.DATABASE_URL).select().from(providersTable).where(eq(providersTable.isEnabled, true));
    for (const p of providers) {
      try {
        await syncProvider(env.DATABASE_URL, p.code, env.PROVIDER_BASE_URL);
      } catch {
        // logged inside sync
      }
    }
  },
};
```

(Adjust imports: rename table import to avoid collision with local variable.)

**Step 2: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): scheduled cron sync"
```

---

# Phase 11: Analytics + Plausible/GA

## Task 11.1: Internal event ingest

**Files:**
- Create: `apps/api/src/routes/events.ts`

```ts
import { Hono } from "hono";
import { createDb } from "@dramaplay/db";
import { analyticsEvents } from "@dramaplay/db";
import type { Env } from "../env";
import { authMiddleware } from "../middleware/auth";

export const events = new Hono<{ Bindings: Env }>();
events.use("*", authMiddleware);

events.post("/", async (c) => {
  const userId = c.get("user").id;
  const body = await c.req.json<{ event: string; properties?: Record<string, unknown> }>();
  const db = createDb(c.env.DATABASE_URL);
  await db.insert(analyticsEvents).values({ userId, event: body.event, properties: body.properties ?? {} });
  return c.json({ ok: true });
});
```

**Step 1: Mount** `app.route("/events", events)`.

**Step 2: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): analytics events ingest"
```

---

## Task 11.2: Plausible/GA snippet in consumer

**Files:**
- Modify: `apps/consumer/index.html`

**Step 1: Add Plausible snippet (or GA) in `<head>`**

```html
<script defer data-domain="dramaplay.id" src="https://plausible.io/js/script.js"></script>
```

**Step 2: Commit**

```bash
git add apps/consumer/index.html
git commit -m "feat(consumer): add plausible analytics"
```

---

# Phase 12: GitHub Actions CI/CD

## Task 12.1: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

**Step 1: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add build/lint/test workflow"
```

---

## Task 12.2: Deploy workflows

**Files:**
- Create: `.github/workflows/deploy-consumer.yml`
- Create: `.github/workflows/deploy-admin.yml`
- Create: `.github/workflows/deploy-api.yml`

**Step 1: `deploy-consumer.yml`**

```yaml
name: Deploy Consumer
on:
  push:
    branches: [main]
    paths: ["apps/consumer/**"]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.12.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @dramaplay/consumer build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: dramaplay-consumer
          directory: apps/consumer/dist
```

**Step 2: Replicate for `deploy-admin.yml`** (project `dramaplay-admin`, dir `apps/admin/dist`).

**Step 3: `deploy-api.yml`**

```yaml
name: Deploy API
on:
  push:
    branches: [main]
    paths: ["apps/api/**", "packages/**"]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.12.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @dramaplay/api exec wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Step 4: Commit**

```bash
git add .github/workflows
git commit -m "ci: add deploy workflows"
```

---

## Task 12.3: DB migration workflow

**Files:**
- Create: `.github/workflows/db-migrate.yml`

```yaml
name: DB Migrate
on:
  workflow_dispatch:
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.12.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @dramaplay/db db:migrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

**Step 1: Commit**

```bash
git add .github/workflows/db-migrate.yml
git commit -m "ci: db migration workflow"
```

---

# Phase 13: Android via Capacitor

## Task 13.1: Init Capacitor

```bash
pnpm --filter @dramaplay/consumer add @capacitor/core
pnpm --filter @dramaplay/consumer add -D @capacitor/cli
pnpm --filter @dramaplay/consumer exec cap init Dramaplay id.dramaplay.app --web-dir=dist
pnpm --filter @dramaplay/consumer add @capacitor/android
pnpm --filter @dramaplay/consumer exec cap add android
```

**Step 1: Commit**

```bash
git add apps/consumer
git commit -m "feat(consumer): init capacitor android"
```

---

## Task 13.2: Configure deep links + splash

**Files:**
- Modify: `apps/consumer/capacitor.config.ts`

**Step 1: Update config**

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "id.dramaplay.app",
  appName: "Dramaplay",
  webDir: "dist",
  server: { androidScheme: "https" },
  plugins: {
    SplashScreen: { showSpinner: false, backgroundColor: "#0f172a" },
  },
};

export default config;
```

**Step 2: Commit**

```bash
git add apps/consumer/capacitor.config.ts
git commit -m "feat(consumer): capacitor config with splash"
```

---

## Task 13.3: Build + sync

```bash
pnpm --filter @dramaplay/consumer build
pnpm --filter @dramaplay/consumer exec cap sync android
pnpm --filter @dramaplay/consumer exec cap open android
```

Expected: Android Studio opens, project builds without error.

**Step 1: Commit**

```bash
git add apps/consumer/android
git commit -m "feat(consumer): sync android project"
```

---

# Phase 14: Stabilization & Smoke Test

## Task 14.1: Smoke test script

**Files:**
- Create: `scripts/smoke.sh`

```bash
#!/usr/bin/env bash
set -e
API=${API_URL:-https://api.dramaplay.id}

curl -fsS "$API/health" | grep -q '"ok":true'
curl -fsS "$API/catalog/trending" | grep -q 'items'
curl -fsS "$API/billing/plans" | grep -q 'items'
echo "smoke ok"
```

**Step 1: Make executable + commit**

```bash
chmod +x scripts/smoke.sh
git add scripts/smoke.sh
git commit -m "test: smoke test script"
```

---

## Task 14.2: Workflow smoke test

**Files:**
- Create: `.github/workflows/smoke-test.yml`

```yaml
name: Smoke Test
on:
  workflow_dispatch:
  schedule:
    - cron: "0 */6 * * *"
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bash scripts/smoke.sh
        env:
          API_URL: https://api.dramaplay.id
```

**Step 1: Commit**

```bash
git add .github/workflows/smoke-test.yml
git commit -m "ci: scheduled smoke test"
```

---

## Task 14.3: README + setup docs

**Files:**
- Modify: `README.md`
- Create: `docs/setup/local-dev.md`

**Step 1: Write README** with sections:

- Overview
- Stack
- Prerequisites (pnpm, Node 20, Supabase local, Wrangler)
- Install (`pnpm install`)
- Env setup (`.dev.vars`, `.env`)
- Local dev (`pnpm dev`)
- Build (`pnpm build`)

**Step 2: Commit**

```bash
git add README.md docs/setup/local-dev.md
git commit -m "docs: local dev setup"
```

---

## Task 14.4: Final merge to main

```bash
git checkout main
git merge --no-ff feat/dramaplay-mvp
```

Expected: clean merge, CI green.

**Step 1: Tag**

```bash
git tag v0.1.0-mvp
```

---

# Completion

After all 14 phases complete and verified:

1. Announce: "I'm using the finishing-a-development-branch skill to complete this work."
2. Use `superpowers:finishing-a-development-branch` to verify tests, present options, and execute the chosen integration path.
