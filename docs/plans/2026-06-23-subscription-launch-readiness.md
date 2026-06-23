# Subscription Launch Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the blockers preventing Dramaplay from safely launching paid VIP subscription.

**Architecture:** Keep fixes local and boring: tests first, DB constraints/atomic updates for payment safety, server-side authz for VIP access, and one small smoke script for the paid journey. Do not add new payment providers, queues, or observability vendors until the current Pakasir/Supabase/Cloudflare stack is proven.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers, React/Vite/PWA, Supabase Auth/Postgres, Drizzle ORM, Pakasir, Vitest, pnpm.

---

## Current Evidence / Blockers

From review on 2026-06-23:

- Production API health: `https://api.dramaplay.my.id/health` returns `200` and DB `up`.
- Billing plans endpoint returns enabled VIP plans.
- Catalog home endpoint returns providers including `melolo`.
- API test suite currently fails: `apps/api/test/sync-fetch-all.test.ts` imports `fetchAllProviderSummaries`, but runtime import returns non-function.
- `pnpm audit --audit-level high` reports critical/high advisories including runtime `drizzle-orm <0.45.2`.
- Pakasir webhook verifies transaction by callback, but subscription creation is not atomic/idempotent enough for retries/races.
- No recorded end-to-end payment smoke evidence exists for: checkout → webhook → paid payment → active subscription → VIP episode unlock.

---

### Task 1: Fix provider sync regression test

**Files:**
- Modify: `apps/api/src/sync/sync.ts`
- Modify: `apps/api/test/sync-fetch-all.test.ts`

**Step 1: Inspect current sync helper state**

Run:
```bash
rg -n "fetchAllProviderSummaries|fetchLatest\(" apps/api/src/sync/sync.ts apps/api/test/sync-fetch-all.test.ts
```

Expected: test references `fetchAllProviderSummaries`; source either lacks export or helper.

**Step 2: Write/restore the failing test intent**

Ensure `apps/api/test/sync-fetch-all.test.ts` contains:

```ts
import { describe, expect, it } from "vitest";
import { fetchAllProviderSummaries } from "../src/sync/sync";

const item = (providerDramaId: string, title = providerDramaId) => ({ providerDramaId, title });

describe("fetchAllProviderSummaries", () => {
  it("merges all provider shelves, not only latest", async () => {
    const items = await fetchAllProviderSummaries({
      fetchForYou: async () => ({ items: [item("for-you"), item("same", "old")] }),
      fetchTrending: async () => [item("trending")],
      fetchLatest: async () => [item("latest"), item("same", "new")],
      fetchVip: async () => [item("vip")],
    } as any);

    expect(items.map((x) => x.providerDramaId).sort()).toEqual(["for-you", "latest", "same", "trending", "vip"]);
    expect(items.find((x) => x.providerDramaId === "same")?.title).toBe("new");
  });
});
```

**Step 3: Run focused test to verify failure**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/sync-fetch-all.test.ts
```

Expected: FAIL with `fetchAllProviderSummaries is not a function` or missing export.

**Step 4: Implement minimal helper**

In `apps/api/src/sync/sync.ts`, add after `SyncResult`:

```ts
export async function fetchAllProviderSummaries(adapter: ReturnType<typeof buildProviders>[string]): Promise<ProviderDramaSummary[]> {
  const batches = await Promise.all([
    adapter.fetchForYou().then((r) => r.items),
    adapter.fetchTrending(),
    adapter.fetchLatest(),
    adapter.fetchVip(),
  ]);

  return [...new Map(batches.flat().filter((x) => x.providerDramaId).map((x) => [x.providerDramaId, x])).values()];
}
```

Replace this line inside `syncProvider`:

```ts
const items: ProviderDramaSummary[] = await adapter.fetchLatest();
```

with:

```ts
const items: ProviderDramaSummary[] = await fetchAllProviderSummaries(adapter);
```

**Step 5: Run focused test**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/sync-fetch-all.test.ts
```

Expected: PASS.

**Step 6: Run API tests**

Run:
```bash
pnpm --filter @dramaplay/api run test
```

Expected: PASS, all tests.

**Step 7: Commit**

```bash
git add apps/api/src/sync/sync.ts apps/api/test/sync-fetch-all.test.ts
git commit -m "fix: sync all provider shelves"
```

---

### Task 2: Make Pakasir webhook idempotent and race-safe

**Files:**
- Modify: `apps/api/src/routes/pakasir.ts`
- Create: `apps/api/test/pakasir-webhook.test.ts`

**Step 1: Write failing tests**

Create `apps/api/test/pakasir-webhook.test.ts` with mocked DB behavior for three cases:

1. Existing payment status is already `paid` → response `{ ok: true }`, no subscription insert.
2. Payment is `pending`, transaction verifies, but conditional update returns no row → response `{ ok: true }`, no subscription insert.
3. Payment is `pending`, transaction verifies, conditional update returns the paid row → one subscription insert.

Use Vitest mocks for `@dramaplay/db` and global `fetch`. Keep the fake DB chain minimal; only implement called methods.

**Step 2: Run focused test to verify failure**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/pakasir-webhook.test.ts
```

Expected: FAIL because current route updates payment unconditionally and creates subscription after update.

**Step 3: Implement atomic payment update**

In `apps/api/src/routes/pakasir.ts`, change import:

```ts
import { and, eq } from "drizzle-orm";
```

Replace payment update block with:

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

Use `paidPayment.userId` and `paidPayment.planId` for subscription creation.

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

### Task 3: Add payment reference uniqueness migration

**Files:**
- Create: `packages/db/drizzle/0001_payment_reference_unique.sql`
- Modify if required: `packages/db/drizzle/meta/_journal.json`
- Test: `apps/api/test/pakasir-webhook.test.ts`

**Step 1: Inspect existing migrations**

Run:
```bash
ls packages/db/drizzle
```

Expected: existing migration files and `meta` directory.

**Step 2: Create migration**

Create `packages/db/drizzle/0001_payment_reference_unique.sql`:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "payments_pakasir_reference_unique"
ON "payments" ("pakasir_reference")
WHERE "pakasir_reference" IS NOT NULL;
```

If Drizzle journal is maintained manually in this repo, add an entry in `packages/db/drizzle/meta/_journal.json` matching the existing format.

**Step 3: Add duplicate-reference test**

Extend `apps/api/test/pakasir-webhook.test.ts` or add a small DB schema assertion test if this repo has migration tests. The practical check is migration review plus webhook idempotency tests; do not build a migration runner just for this.

**Step 4: Run DB package typecheck**

Run:
```bash
pnpm --filter @dramaplay/db run typecheck
```

Expected: PASS, if script exists. If missing, record as skipped and run root typecheck later.

**Step 5: Commit**

```bash
git add packages/db/drizzle/0001_payment_reference_unique.sql packages/db/drizzle/meta/_journal.json apps/api/test/pakasir-webhook.test.ts
git commit -m "fix: enforce unique pakasir payment references"
```

---

### Task 4: Upgrade vulnerable runtime dependencies

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `packages/db/package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Inspect dependency ownership**

Run:
```bash
pnpm why drizzle-orm
pnpm why vitest
pnpm why vite
pnpm --filter @dramaplay/api why wrangler
```

Expected: `drizzle-orm` used by API and DB packages; test/dev stack owns Vitest/Vite/Wrangler.

**Step 2: Upgrade Drizzle first**

Run:
```bash
pnpm up drizzle-orm@^0.45.2 -r
```

Expected: lockfile and package manifests update.

**Step 3: Run API and DB checks**

Run:
```bash
pnpm --filter @dramaplay/api run typecheck
pnpm --filter @dramaplay/api run test
```

Expected: PASS. Fix type/API changes only if compiler requires it. Do not refactor queries.

**Step 4: Upgrade dev tooling advisories**

Run:
```bash
pnpm up vitest@^3.2.6 vite@latest wrangler@^4 -r
```

Expected: lockfile updates. If Wrangler v4 changes deploy behavior, keep deploy command documented but do not deploy yet.

**Step 5: Run all local checks**

Run:
```bash
pnpm -r run typecheck
pnpm -r run test
pnpm --filter @dramaplay/consumer run build
pnpm audit --audit-level high
```

Expected:
- typecheck PASS
- tests PASS
- consumer build PASS, chunk warning acceptable
- audit has no high/critical runtime advisories. If dev-only advisories remain, list them in `docs/launch-readiness.md` with rationale.

**Step 6: Commit**

```bash
git add package.json apps/api/package.json packages/db/package.json pnpm-lock.yaml docs/launch-readiness.md
git commit -m "chore: update dependencies for launch readiness"
```

---

### Task 5: Add subscription smoke script

**Files:**
- Create: `apps/api/scripts/smoke-subscription.ts`
- Modify: `apps/api/package.json`
- Create: `docs/launch-readiness.md`

**Step 1: Create smoke script**

Create `apps/api/scripts/smoke-subscription.ts`:

```ts
const api = process.env.API_URL ?? "https://api.dramaplay.my.id";
const token = process.env.SMOKE_USER_TOKEN;

if (!token) {
  console.error("SMOKE_USER_TOKEN is required");
  process.exit(1);
}

async function req(path: string, init: RequestInit = {}) {
  const res = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }
  console.log(path, res.status, JSON.stringify(body).slice(0, 300));
  return { res, body };
}

const plans = await req("/billing/plans");
if (!plans.res.ok) process.exit(1);

const me = await req("/auth/me");
if (!me.res.ok) process.exit(1);

const checkout = await req("/billing/checkout", {
  method: "POST",
  body: JSON.stringify({ planCode: "vip_weekly" }),
});
if (!checkout.res.ok) process.exit(1);

console.log("Manual next step: pay checkoutUrl, then run this script again and verify /auth/me user.isVip is true.");
```

**Step 2: Add package script**

In `apps/api/package.json`, add:

```json
"smoke:subscription": "tsx scripts/smoke-subscription.ts"
```

**Step 3: Run without token to verify guard**

Run:
```bash
pnpm --filter @dramaplay/api run smoke:subscription
```

Expected: exits 1 with `SMOKE_USER_TOKEN is required`.

**Step 4: Run with a real test user token**

Run:
```bash
set -a && source .env.deploy && set +a
SMOKE_USER_TOKEN=<test-user-jwt> pnpm --filter @dramaplay/api run smoke:subscription
```

Expected:
- `/billing/plans` 200
- `/auth/me` 200
- `/billing/checkout` 200 with `checkoutUrl`

Do not commit real token.

**Step 5: Document manual payment verification**

Create/update `docs/launch-readiness.md`:

```md
# Launch Readiness

## Subscription Smoke Evidence

- Date:
- API URL:
- Test user:
- Plan:
- Checkout created: yes/no
- Pakasir payment completed: yes/no
- Webhook received: yes/no
- Payment status paid: yes/no
- `/auth/me` returns `isVip: true`: yes/no
- VIP episode unlock tested: yes/no

## Remaining Risks

- Fill after smoke.
```

**Step 6: Commit**

```bash
git add apps/api/scripts/smoke-subscription.ts apps/api/package.json docs/launch-readiness.md
git commit -m "test: add subscription smoke check"
```

---

### Task 6: Verify VIP access control end-to-end

**Files:**
- Modify: `apps/api/test/watch.test.ts`
- Modify if needed: `apps/api/src/routes/watch.ts`
- Update: `docs/launch-readiness.md`

**Step 1: Add missing watch tests**

In `apps/api/test/watch.test.ts`, add/confirm tests for:

1. Free episode returns stream without auth.
2. VIP episode without auth returns 403.
3. VIP episode with non-VIP token returns 403.
4. VIP episode with active VIP returns stream.
5. VIP episode responses are not cached across users.

**Step 2: Run focused test**

Run:
```bash
pnpm --filter @dramaplay/api exec vitest run test/watch.test.ts
```

Expected: PASS. If any test fails, fix only `apps/api/src/routes/watch.ts`.

**Step 3: Add production smoke notes**

Update `docs/launch-readiness.md` with manual API checks:

```bash
curl -i https://api.dramaplay.my.id/watch/<free-slug>/1
curl -i https://api.dramaplay.my.id/watch/<vip-slug>/1
curl -i -H "Authorization: Bearer <free-user-token>" https://api.dramaplay.my.id/watch/<vip-slug>/1
curl -i -H "Authorization: Bearer <vip-user-token>" https://api.dramaplay.my.id/watch/<vip-slug>/1
```

Expected statuses: 200, 403, 403, 200.

**Step 4: Commit**

```bash
git add apps/api/test/watch.test.ts apps/api/src/routes/watch.ts docs/launch-readiness.md
git commit -m "test: verify vip watch access"
```

---

### Task 7: Add minimal legal/support pages before paid launch

**Files:**
- Create: `apps/consumer/src/pages/Terms.tsx`
- Create: `apps/consumer/src/pages/Privacy.tsx`
- Create: `apps/consumer/src/pages/Refund.tsx`
- Modify: `apps/consumer/src/App.tsx`
- Modify: `apps/consumer/src/pages/Profile.tsx`

**Step 1: Create static pages**

Create simple Indonesian pages with placeholders that must be reviewed by business/legal before launch:

`Terms.tsx`: terms of use, VIP duration, acceptable use, contact.

`Privacy.tsx`: auth email, payment metadata, analytics events, retention, contact.

`Refund.tsx`: refund/support policy, payment troubleshooting, contact.

Keep content short. Add `TODO legal review` comment at top.

**Step 2: Register routes**

In `apps/consumer/src/App.tsx`, import pages and add routes:

```tsx
<Route path="/terms" element={<Terms />} />
<Route path="/privacy" element={<Privacy />} />
<Route path="/refund" element={<Refund />} />
```

**Step 3: Link pages from profile/pricing area**

In `apps/consumer/src/pages/Profile.tsx`, add links near VIP activation/payment history:

```tsx
<Link to="/terms">Ketentuan</Link>
<Link to="/privacy">Privasi</Link>
<Link to="/refund">Refund</Link>
```

**Step 4: Run consumer checks**

Run:
```bash
pnpm --filter @dramaplay/consumer run typecheck
pnpm --filter @dramaplay/consumer run build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/consumer/src/pages/Terms.tsx apps/consumer/src/pages/Privacy.tsx apps/consumer/src/pages/Refund.tsx apps/consumer/src/App.tsx apps/consumer/src/pages/Profile.tsx
git commit -m "feat: add launch legal pages"
```

---

### Task 8: Final production verification and deploy

**Files:**
- Update: `docs/launch-readiness.md`

**Step 1: Run full verification**

Run:
```bash
pnpm -r run typecheck
pnpm -r run test
pnpm --filter @dramaplay/consumer run build
pnpm audit --audit-level high
```

Expected: PASS or documented dev-only exceptions. No runtime high/critical advisories.

**Step 2: Deploy API**

Run:
```bash
set -a && source .env.deploy && set +a
cd apps/api
pnpm exec wrangler deploy --name "$CLOUDFLARE_WORKER_API_NAME"
```

Expected: deploy success with new Version ID.

**Step 3: Deploy consumer**

Run:
```bash
set -a && source .env.deploy && set +a
pnpm --filter @dramaplay/consumer run build
cd apps/api
pnpm exec wrangler pages deploy ../consumer/dist --project-name "$CLOUDFLARE_PAGES_CONSUMER_PROJECT"
```

Expected: Pages deploy success URL.

**Step 4: Production smoke**

Run:
```bash
node - <<'NODE'
for (const url of [
  'https://api.dramaplay.my.id/health',
  'https://api.dramaplay.my.id/billing/plans',
  'https://api.dramaplay.my.id/catalog/home'
]) {
  const r = await fetch(url);
  console.log(url, r.status, (await r.text()).slice(0, 300));
}
NODE
```

Expected: all 200.

Then run subscription smoke with real test token:

```bash
set -a && source .env.deploy && set +a
SMOKE_USER_TOKEN=<test-user-jwt> pnpm --filter @dramaplay/api run smoke:subscription
```

Expected: checkout created. Complete payment manually in Pakasir test/live-small mode, then verify `/auth/me` returns VIP and VIP episode unlocks.

**Step 5: Update launch readiness report**

Update `docs/launch-readiness.md` with:

- API deploy Version ID
- Consumer Pages deploy URL
- command outputs summary
- subscription smoke results
- remaining risks
- go/no-go verdict

**Step 6: Commit deploy docs**

```bash
git add docs/launch-readiness.md
git commit -m "docs: record launch readiness verification"
```

---

## Launch Decision Gate

Only mark Dramaplay as subscription-launch-ready when all are true:

- API tests pass.
- Consumer build passes.
- Runtime high/critical dependency advisories are resolved or explicitly accepted with evidence they are dev-only.
- Pakasir webhook is idempotent.
- Payment reference uniqueness is enforced.
- Subscription smoke checkout works.
- A real paid/test transaction activates VIP.
- Free user cannot access VIP episode.
- VIP user can access VIP episode.
- Terms, privacy, refund/support pages exist and are reviewed.

If any item is missing, launch status remains: **beta/free soft launch only**.
