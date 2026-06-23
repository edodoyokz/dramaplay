# Production Hardening From Review Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the verified production blockers from the critical review: payment race safety, DB connection reuse, validation, rate limiting, stale VIP cache, lint failures, episode uniqueness, and admin pagination.

**Architecture:** Keep changes small and local. Add tiny shared helpers only where they remove duplication or protect trust boundaries. Prefer DB constraints and atomic updates over app-side assumptions.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers, Drizzle ORM, PostgreSQL/Supabase, Vitest, React/Vite, pnpm.

---

## Verification Baseline

Before starting, run:

```bash
pnpm -r run typecheck
pnpm -r run test
pnpm -r run build
pnpm -r run lint
```

Expected baseline:
- typecheck: PASS
- tests: PASS, 45 tests
- build: PASS with consumer chunk-size warning
- lint: FAIL in `apps/consumer/src/pages/Home.tsx`, `ProviderDramas.tsx`, `Search.tsx`

---

### Task 1: Fix consumer lint failures

**Files:**
- Modify: `apps/consumer/src/pages/Home.tsx`
- Modify: `apps/consumer/src/pages/ProviderDramas.tsx`
- Modify: `apps/consumer/src/pages/Search.tsx`

**Step 1: Run focused lint and confirm failure**

Run:
```bash
pnpm --filter @dramaplay/consumer run lint
```

Expected: FAIL with `react-hooks/set-state-in-effect` on the three files above.

**Step 2: Apply minimal lint fix**

In `Home.tsx`, initialize `loadingHome` as `true` and remove the synchronous `setLoadingHome(true)` at the top of the mount-only effect. If reload behavior is needed later, do it from the async callback, not initial mount.

In `ProviderDramas.tsx`, avoid synchronous reset inside the effect. Prefer remounting list state by route key if simple, or move reset into the async loader path.

In `Search.tsx`, replace the synchronous empty-query branch state reset with derived rendering where possible. If state reset is needed, schedule it from debounced async flow.

Keep the diff minimal. Do not introduce new state managers.

**Step 3: Run focused lint**

Run:
```bash
pnpm --filter @dramaplay/consumer run lint
```

Expected: PASS.

**Step 4: Run consumer typecheck**

Run:
```bash
pnpm --filter @dramaplay/consumer run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/consumer/src/pages/Home.tsx apps/consumer/src/pages/ProviderDramas.tsx apps/consumer/src/pages/Search.tsx
git commit -m "fix: resolve consumer lint errors"
```

---

### Task 2: Make Pakasir webhook atomic

**Files:**
- Modify: `apps/api/src/routes/pakasir.ts`
- Test: `apps/api/test/pakasir-webhook.test.ts`

**Step 1: Write failing race/idempotency tests**

Create `apps/api/test/pakasir-webhook.test.ts` with tests that verify:
1. If payment is already `paid`, no new subscription is inserted.
2. If the conditional payment update returns no row, no subscription is inserted.
3. If pending payment update returns one row, exactly one subscription is inserted.

Use Vitest mocks for `@dramaplay/db` and `fetch`. Keep the mock DB tiny: implement only `select`, `update`, `insert`, `where`, `set`, `returning` used by this route.

**Step 2: Run test and confirm failure**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/pakasir-webhook.test.ts
```

Expected: FAIL because current route updates payment without conditional `status = pending` guard.

**Step 3: Implement atomic update**

In `apps/api/src/routes/pakasir.ts`, after `verifyTransaction` succeeds, replace unconditional update with conditional update:

```ts
const [paidPayment] = await db
  .update(payments)
  .set({
    status: "paid",
    pakasirTransactionId: body.order_id,
    payload: JSON.stringify(body),
    paidAt: body.completed_at ? new Date(body.completed_at) : new Date(),
  })
  .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")))
  .returning();

if (!paidPayment) return c.json({ ok: true });
```

Then use `paidPayment.planId` and `paidPayment.userId` for subscription creation.

Add import:

```ts
import { and, eq } from "drizzle-orm";
```

Replace existing `eq` import accordingly.

**Step 4: Run focused test**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/pakasir-webhook.test.ts
```

Expected: PASS.

**Step 5: Run API tests**

Run:
```bash
pnpm --filter @dramaplay/api run test
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/api/src/routes/pakasir.ts apps/api/test/pakasir-webhook.test.ts
git commit -m "fix: make pakasir webhook idempotent"
```

---

### Task 3: Reuse DB instance during provider sync

**Files:**
- Modify: `apps/api/src/sync/sync.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/routes/admin.ts`
- Test: `apps/api/test/sync-db-reuse.test.ts`

**Step 1: Write failing test**

Create `apps/api/test/sync-db-reuse.test.ts` to assert `syncProvider` accepts an existing DB object and does not call `createDb` when DB object is passed.

Expected API shape:

```ts
await syncProvider(db, providerCode, baseUrl, token);
```

**Step 2: Run test and confirm failure**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/sync-db-reuse.test.ts
```

Expected: FAIL because `syncProvider` currently accepts only `dbUrl: string` and calls `createDb` internally.

**Step 3: Change syncProvider signature minimally**

In `apps/api/src/sync/sync.ts`:

```ts
export async function syncProvider(
  dbOrUrl: string | Database,
  providerCode: string,
  providerBaseUrl: string,
  providerToken?: string
): Promise<SyncResult> {
  const db = typeof dbOrUrl === "string" ? createDb(dbOrUrl) : dbOrUrl;
  ...
}
```

Import `type Database` from `@dramaplay/db`.

**Step 4: Pass existing DB from scheduled handler**

In `apps/api/src/index.ts`, change:

```ts
await syncProvider(env.DATABASE_URL, p.code, env.PROVIDER_BASE_URL, env.PROVIDER_API_TOKEN);
```

to:

```ts
await syncProvider(db, p.code, env.PROVIDER_BASE_URL, env.PROVIDER_API_TOKEN);
```

**Step 5: Keep admin manual sync working**

In `apps/api/src/routes/admin.ts`, either keep URL usage or create one DB and pass it. Minimal acceptable:

```ts
await syncProvider(c.env.DATABASE_URL, ...)
```

No behavior change required for manual sync.

**Step 6: Run focused test**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/sync-db-reuse.test.ts
```

Expected: PASS.

**Step 7: Run API tests and typecheck**

Run:
```bash
pnpm --filter @dramaplay/api run test
pnpm --filter @dramaplay/api run typecheck
```

Expected: PASS.

**Step 8: Commit**

```bash
git add apps/api/src/sync/sync.ts apps/api/src/index.ts apps/api/src/routes/admin.ts apps/api/test/sync-db-reuse.test.ts
git commit -m "fix: reuse database connection during sync"
```

---

### Task 4: Add runtime validation at trust boundaries

**Files:**
- Create: `apps/api/src/lib/validation.ts`
- Modify: `apps/api/src/routes/billing.ts`
- Modify: `apps/api/src/routes/pakasir.ts`
- Modify: `apps/api/src/routes/admin.ts`
- Test: `apps/api/test/validation.test.ts`

**Step 1: Write failing tests**

Create tests verifying invalid requests return `400`:
- `/billing/checkout` with missing `planCode`
- `/billing/checkout` with non-string `planCode`
- `/pakasir/webhook` with negative/non-number amount
- `/admin/dramas/:id/access` with invalid `accessType`

**Step 2: Run tests and confirm failure**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/validation.test.ts
```

Expected: FAIL.

**Step 3: Add tiny validator helper**

Create `apps/api/src/lib/validation.ts`:

```ts
export function stringField(body: Record<string, unknown>, key: string): string | null {
  const v = body[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function numberField(body: Record<string, unknown>, key: string): number | null {
  const v = body[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function enumField<T extends string>(body: Record<string, unknown>, key: string, allowed: readonly T[]): T | null {
  const v = body[key];
  return typeof v === "string" && allowed.includes(v as T) ? (v as T) : null;
}
```

No dependency. YAGNI.

**Step 4: Use helper in routes**

In `billing.ts`:

```ts
const body = await c.req.json<Record<string, unknown>>().catch(() => null);
if (!body) return c.json({ error: "bad_request" }, 400);
const planCode = stringField(body, "planCode");
if (!planCode) return c.json({ error: "bad_request" }, 400);
```

In `pakasir.ts`, validate required fields before DB work:

```ts
const amount = numberField(body, "amount");
const orderId = stringField(body, "order_id");
const project = stringField(body, "project");
const status = stringField(body, "status");
if (!amount || amount < 1 || !orderId || !project || !status) return c.json({ error: "bad_request" }, 400);
```

In `admin.ts` access route:

```ts
const accessType = enumField(body, "accessType", ["free", "vip"] as const);
if (!accessType) return c.json({ error: "bad_request" }, 400);
```

**Step 5: Run tests**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/validation.test.ts
pnpm --filter @dramaplay/api run test
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/api/src/lib/validation.ts apps/api/src/routes/billing.ts apps/api/src/routes/pakasir.ts apps/api/src/routes/admin.ts apps/api/test/validation.test.ts
git commit -m "fix: validate api request bodies"
```

---

### Task 5: Add minimal API rate limiting

**Files:**
- Create: `apps/api/src/middleware/rate-limit.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/test/rate-limit.test.ts`

**Step 1: Write failing test**

Create `apps/api/test/rate-limit.test.ts` with a tiny Hono app using the middleware. Send N+1 requests from same IP and assert the last returns `429`.

**Step 2: Run test and confirm failure**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/rate-limit.test.ts
```

Expected: FAIL because middleware does not exist.

**Step 3: Implement minimal in-isolate limiter**

Create `apps/api/src/middleware/rate-limit.ts`:

```ts
import { createMiddleware } from "hono/factory";

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(limit: number, windowMs: number) {
  return createMiddleware(async (c, next) => {
    const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("x-forwarded-for") ?? "unknown";
    const key = `${ip}:${c.req.path}`;
    const now = Date.now();
    const hit = hits.get(key);
    if (!hit || hit.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (hit.count >= limit) return c.json({ error: "rate_limited" }, 429);
    hit.count++;
    return next();
  });
}
```

Note: in-isolate only. Good enough as first guard; use Cloudflare WAF/rules for stronger global limits.

**Step 4: Apply to hot routes**

In `apps/api/src/index.ts` before route registration:

```ts
import { rateLimit } from "./middleware/rate-limit";

app.use("/catalog/search", rateLimit(30, 60_000));
app.use("/billing/checkout", rateLimit(10, 60_000));
app.use("/pakasir/webhook", rateLimit(60, 60_000));
app.use("/auth/*", rateLimit(30, 60_000));
```

**Step 5: Run tests**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/rate-limit.test.ts
pnpm --filter @dramaplay/api run test
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/api/src/middleware/rate-limit.ts apps/api/src/index.ts apps/api/test/rate-limit.test.ts
git commit -m "feat: add minimal api rate limiting"
```

---

### Task 6: Prevent stale VIP cache bypass

**Files:**
- Modify: `apps/api/src/routes/watch.ts`
- Modify: `apps/api/test/watch.test.ts`

**Step 1: Add failing test**

In `apps/api/test/watch.test.ts`, add test:
1. First request episode 1 as free and caches stream.
2. Reset mocked DB state and make same episode return `accessType: "vip"`.
3. Request same URL without auth.
4. Expected: `403`, not cached `200`.

**Step 2: Run test and confirm failure**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/watch.test.ts
```

Expected: FAIL because cache is checked before DB episode access type.

**Step 3: Minimal implementation**

Move cache lookup until after drama + episode DB lookup. Only return cached data if `episode.accessType === "free"`.

Pseudo-shape:

```ts
const db = createDb(c.env.DATABASE_URL);
const [drama] = ...;
const [episode] = ...;

if (episode.accessType === "free") {
  const hit = watchCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return c.json(hit.data as Record<string, unknown>);
}
```

Do not cache VIP responses.

**Step 4: Remove pointless Promise.all**

Change:

```ts
const [providerInfo] = await Promise.all([getPrimaryProvider(db, drama.id)]);
```

to:

```ts
const providerInfo = await getPrimaryProvider(db, drama.id);
```

**Step 5: Run tests**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/watch.test.ts
pnpm --filter @dramaplay/api run test
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/api/src/routes/watch.ts apps/api/test/watch.test.ts
git commit -m "fix: avoid stale watch cache for vip episodes"
```

---

### Task 7: Add episode uniqueness constraint

**Files:**
- Modify: `packages/db/src/schema/catalog.ts`
- Create: Drizzle migration under `packages/db/drizzle/`
- Modify: `apps/api/src/sync/sync.ts`
- Test: `apps/api/test/sync-episodes.test.ts`

**Step 1: Add schema constraint**

In `packages/db/src/schema/catalog.ts`, add a unique constraint on `(dramaId, episodeNumber)`.

Use Drizzle pg-core unique API matching project version. Example shape:

```ts
import { unique } from "drizzle-orm/pg-core";

export const episodes = pgTable(
  "episodes",
  { ... },
  (t) => [unique("episodes_drama_id_episode_number_unique").on(t.dramaId, t.episodeNumber)]
);
```

**Step 2: Generate migration**

Run:
```bash
pnpm --filter @dramaplay/db run db:generate
```

Expected: new migration adds unique constraint/index.

**Step 3: Make sync robust to conflicts**

In `apps/api/src/sync/sync.ts`, keep existing preselect but add `.onConflictDoNothing()` to episode insert if supported with returning behavior. If Drizzle returns empty rows on conflict, current `episodeProviders` insert uses only inserted rows, which is fine.

**Step 4: Add test for duplicate episode safety**

Create `apps/api/test/sync-episodes.test.ts` asserting duplicate provider episodes do not crash sync and do not create duplicate provider rows.

**Step 5: Run DB typecheck and API tests**

Run:
```bash
pnpm --filter @dramaplay/db run typecheck
pnpm --filter @dramaplay/api run test
```

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/db/src/schema/catalog.ts packages/db/drizzle apps/api/src/sync/sync.ts apps/api/test/sync-episodes.test.ts
git commit -m "fix: enforce unique episode numbers per drama"
```

---

### Task 8: Add admin pagination

**Files:**
- Modify: `apps/api/src/routes/admin.ts`
- Modify: `apps/admin/src/lib/api.ts` if needed
- Modify: admin pages that consume list endpoints if needed:
  - `apps/admin/src/pages/Dramas.tsx`
  - `apps/admin/src/pages/Users.tsx`
  - `apps/admin/src/pages/Payments.tsx`
  - `apps/admin/src/pages/Reports.tsx`
- Test: `apps/api/test/admin-pagination.test.ts`

**Step 1: Write failing API test**

Create `apps/api/test/admin-pagination.test.ts` verifying endpoints accept `page` and `limit`, and call `.offset((page - 1) * limit)`.

Endpoints:
- `/admin/dramas?page=2&limit=20`
- `/admin/users?page=2&limit=20`
- `/admin/payments?page=2&limit=20`
- `/admin/reports?page=2&limit=20`

**Step 2: Run test and confirm failure**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/admin-pagination.test.ts
```

Expected: FAIL because routes currently hardcode `.limit(50)`.

**Step 3: Add helper inside admin route**

In `apps/api/src/routes/admin.ts`:

```ts
function pagination(c: { req: { query(name: string): string | undefined } }) {
  const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 50) || 50));
  return { page, limit, offset: (page - 1) * limit };
}
```

Use it on all four routes:

```ts
const { page, limit, offset } = pagination(c);
const rows = await db.select().from(dramas).limit(limit).offset(offset);
return c.json({ items: rows, page, limit, hasMore: rows.length === limit });
```

Import `payments` and `reports` statically; remove dynamic imports.

**Step 4: Update admin UI only if it assumes old response**

If pages only read `res.items`, no UI change required. If they assume array response, adjust minimally.

**Step 5: Run tests**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/admin-pagination.test.ts
pnpm --filter @dramaplay/api run test
pnpm --filter @dramaplay/admin run typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/api/src/routes/admin.ts apps/api/test/admin-pagination.test.ts apps/admin/src
git commit -m "feat: paginate admin list endpoints"
```

---

### Task 9: Add search length guard

**Files:**
- Modify: `apps/api/src/routes/catalog.ts`
- Test: `apps/api/test/catalog-search.test.ts`

**Step 1: Write failing test**

Create `apps/api/test/catalog-search.test.ts` verifying `/catalog/search?q=<201 chars>` returns `400`.

**Step 2: Run test and confirm failure**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/catalog-search.test.ts
```

Expected: FAIL.

**Step 3: Add minimal guard**

In `apps/api/src/routes/catalog.ts` search route, after trim:

```ts
if (q.length > 100) return c.json({ error: "query_too_long" }, 400);
```

Keep existing `<2 chars` behavior.

**Step 4: Run tests**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/catalog-search.test.ts
pnpm --filter @dramaplay/api run test
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/src/routes/catalog.ts apps/api/test/catalog-search.test.ts
git commit -m "fix: limit catalog search query length"
```

---

### Task 10: Final verification

**Files:**
- No code changes unless verification fails.

**Step 1: Run full verification**

Run:
```bash
pnpm -r run typecheck
pnpm -r run test
pnpm -r run build
pnpm -r run lint
```

Expected:
- typecheck: PASS
- tests: PASS
- build: PASS, consumer chunk warning acceptable for now
- lint: PASS

**Step 2: Review diff**

Run:
```bash
git diff --stat main...HEAD
git diff main...HEAD -- apps/api/src/routes/pakasir.ts apps/api/src/sync/sync.ts apps/api/src/routes/watch.ts packages/db/src/schema/catalog.ts
```

Expected: Small, focused changes. No unrelated UI rewrites.

**Step 3: Commit any final fixes**

If final fixes were needed:

```bash
git add <changed-files>
git commit -m "chore: finalize production hardening"
```

---

## Notes / Explicit Deferrals

- Cloudflare KV/Cache API for catalog cache is deferred. Current in-isolate cache is limited but not the top blocker after VIP stale-cache fix.
- Full global rate limiting should eventually move to Cloudflare WAF/rules. The in-app limiter is a minimal first guard.
- Consumer bundle splitting is deferred. Build warns but passes.
- CSP/security headers are deferred to a separate launch-hardening pass.
