# Safe Error Report Email Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a safe report button flow that stores reports and emails support when users report playback or app errors.

**Architecture:** Add `POST /reports` to the API, backed by existing `reports` table and optional Supabase auth. Add a minimal Watch report modal that sends sanitized context. Use Resend only server-side with Worker secrets.

**Tech Stack:** Hono Worker API, Drizzle/Postgres, Resend HTTP API, Vite React consumer, Vitest.

---

### Task 1: API report endpoint

**Files:**

- Create: `apps/api/src/routes/reports.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/test/reports.test.ts`

**Step 1: Write failing tests**

Test these cases:

- anonymous valid episode report returns 200 and inserts one `reports` row
- invalid reason returns 400
- rate limit returns 429 after 5 reports from same IP
- Resend failure still returns 200 after DB insert

**Step 2: Implement minimal endpoint**

Add:

- reason enum validation
- `message` max 500 chars
- `userAgent` max 300 chars
- optional auth via existing `getUserId`
- episode lookup by `dramaSlug + episodeNumber`
- insert into existing `reports`
- email via `fetch("https://api.resend.com/emails")`
- in-memory rate limiter keyed by user id or IP

**Step 3: Mount route**

Mount in `apps/api/src/index.ts` as `/reports`.

**Step 4: Verify**

Run:

```bash
pnpm --filter @dramaplay/api exec vitest run test/reports.test.ts
pnpm --filter @dramaplay/api run test
pnpm --filter @dramaplay/api run typecheck
```

---

### Task 2: Watch report modal

**Files:**

- Modify: `apps/consumer/src/pages/Watch.tsx`

**Step 1: Replace confirm report**

Replace `window.confirm` with a small modal:

- reason dropdown/buttons
- optional note textarea max 500
- cancel/submit

**Step 2: Send safe payload**

POST to `/reports`:

```ts
{
  targetType: "episode",
  dramaSlug: data.dramaSlug,
  episodeNumber: data.episodeNumber,
  reason,
  message,
  client: {
    path: window.location.pathname,
    userAgent: navigator.userAgent,
  },
}
```

Do not send cookies, tokens, localStorage, or headers.

**Step 3: Verify**

Run:

```bash
pnpm --filter @dramaplay/consumer run typecheck
pnpm --filter @dramaplay/consumer run build
```

---

### Task 3: Deploy and smoke

**Files:**

- Modify: `docs/launch-readiness.md`

**Step 1: Confirm secrets**

Required Worker secrets:

- `RESEND_API_KEY`
- `REPORT_EMAIL_TO=webdev@nusanexus.com`

**Step 2: Deploy**

```bash
set -a && source .env.deploy && set +a
cd apps/api
pnpm exec wrangler deploy --name "$CLOUDFLARE_WORKER_API_NAME"
pnpm --filter @dramaplay/consumer run build
pnpm exec wrangler pages deploy ../consumer/dist --project-name "$CLOUDFLARE_PAGES_CONSUMER_PROJECT"
```

**Step 3: Smoke**

Submit one report from a real Watch page and confirm:

- API returns 200
- row appears in `reports`
- email arrives at `webdev@nusanexus.com`

**Step 4: Document evidence**

Update `docs/launch-readiness.md` with deploy IDs and smoke result.
