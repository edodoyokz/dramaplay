# WeTV and MovieBox Long-form Providers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add WeTV and MovieBox to existing provider/Home catalogs while routing their films and series to dedicated long-form detail and landscape watch pages.

**Architecture:** Implement two provider adapters against the verified live shapes, store a small content marker in existing provider-link metadata, and return that marker through catalog APIs. Consumer cards use the marker to select existing short-form routes or new long-form routes; auth, VIP, reporting, image proxy, and deployment remain shared.

**Tech Stack:** TypeScript, Hono, Drizzle/Postgres, React/Vite, Vitest, Cloudflare Workers/Pages, pnpm.

---

### Task 1: Preserve and verify the PineDrama cover fix

**Files:**
- Modify: `.github/workflows/daily-sync.yml`
- Modify: `apps/api/scripts/sync-providers.ts`
- Create: `apps/api/scripts/backfill-pinedrama-posters.ts`
- Modify: `apps/api/src/sync/sync.ts`
- Test: `apps/api/test/sync-fetch-all.test.ts`

**Steps:**
1. Run `pnpm --filter @dramaplay/api exec vitest run test/sync-fetch-all.test.ts` and expect 3 passing tests.
2. Run the cover-only backfill with deployment env and expect `{ total: 243, updated: 243, cached: 243, failed: 0 }` (catalog size may increase).
3. Probe expired-query variants through `/img`; expect HTTP 200 image responses.
4. Remove temporary `apps/api/scripts/inspect-one-pinedrama.ts`.
5. Commit only the scoped PineDrama files.

### Task 2: Add long-form content contracts

**Files:**
- Modify: `packages/shared/src/provider/types.ts`
- Modify: `packages/db/src/schema/catalog.ts` only if existing `dramaProviders.metadata` typing cannot hold the marker (prefer no schema change).
- Test: `apps/api/test/longform-contract.test.ts`

**Steps:**
1. Write a failing type/runtime test for `contentType: "shortform" | "longform"`, `mediaType: "movie" | "series"`, and provider episode playback metadata.
2. Run the targeted test and confirm RED.
3. Add the minimum optional fields to shared provider summary/detail/episode types; reuse `dramaProviders.metadata` without migration.
4. Run the test and API typecheck; expect PASS.
5. Commit.

### Task 3: Implement the WeTV adapter from fixtures

**Files:**
- Create: `apps/api/src/providers/sapimu/providers/wetv.ts`
- Modify: `apps/api/src/providers/sapimu/providers/index.ts`
- Test: `apps/api/test/wetv-provider.test.ts`

**Steps:**
1. Build sanitized fixture constants from `/tmp/wetv-feed.json`, detail, episodes, and play response shapes; do not commit tokens or complete paid responses.
2. Write failing tests asserting `cid`, title, portrait/landscape covers, movie/series detection, `vid`, episode numbers, duration, playable URL, and subtitles.
3. Implement the smallest custom adapter/overrides using GET endpoints and verified field names.
4. Run `pnpm --filter @dramaplay/api exec vitest run test/wetv-provider.test.ts`; expect PASS.
5. Run API typecheck and commit.

### Task 4: Implement the MovieBox long-form adapter from fixtures

**Files:**
- Create: `apps/api/src/providers/sapimu/moviebox.ts`
- Modify: `apps/api/src/providers/registry.ts`
- Test: `apps/api/test/moviebox-provider.test.ts`

**Steps:**
1. Create sanitized fixtures from home/detail/stream shapes; exclude Shorts.
2. Write failing tests for POST search support, home mapping, nested `cover.url`, film versus series detection, season/episode playback IDs, and `resourceLink` stream mapping.
3. Implement a small dedicated adapter because list/search methods mix GET and POST.
4. Run the targeted test; expect PASS.
5. Run API typecheck and commit.

### Task 5: Register providers and sync long-form metadata

**Files:**
- Modify: `apps/api/src/sync/sync.ts`
- Modify: `apps/api/scripts/sync-providers.ts`
- Modify: `.github/workflows/daily-sync.yml`
- Modify: provider seed/migration file found by `rg 'pinedrama|goodshort' packages/db apps/api -g '*.ts' -g '*.sql'`
- Test: `apps/api/test/longform-sync.test.ts`

**Steps:**
1. Write failing tests that sync preserves `contentType`, `mediaType`, and playback metadata in `dramaProviders.metadata` while keeping existing short-form behavior.
2. Add WeTV/MovieBox provider seeds and scheduled workflow choices; stagger schedules rather than adding another simultaneous job.
3. Update sync minimally to persist metadata and map movies to one episode.
4. Run targeted sync tests and API typecheck; expect PASS.
5. Commit.

### Task 6: Return marker-driven catalog responses

**Files:**
- Modify: `apps/api/src/routes/catalog.ts`
- Modify: `apps/api/src/routes/watch.ts`
- Test: `apps/api/test/longform-catalog.test.ts`

**Steps:**
1. Write failing route tests asserting Home/provider/detail responses expose content/media type and long-form watch resolves the provider playback reference only after existing entitlement checks.
2. Join/select existing provider-link metadata in catalog queries.
3. Preserve response compatibility by making new fields additive.
4. Run targeted tests, full API tests, and typecheck; expect PASS.
5. Commit.

### Task 7: Add marker-driven Consumer routing and cards

**Files:**
- Modify: `apps/consumer/src/App.tsx`
- Modify: `apps/consumer/src/pages/Home.tsx`
- Modify: `apps/consumer/src/pages/ProviderDramas.tsx`
- Create: `apps/consumer/src/lib/content-route.ts`
- Test: `apps/consumer/test/content-route.test.ts`

**Steps:**
1. Write failing pure-helper tests: short-form routes to existing detail; long-form routes to `/title/:slug`; Film/Serial label derives from `mediaType`.
2. Implement the helper and additive API response typings.
3. Use it in Home and provider cards; add compact accessible type labels.
4. Add routes for long-form detail/watch without implementing their pages beyond placeholders required for route tests.
5. Run targeted test and Consumer typecheck; expect PASS.
6. Commit.

### Task 8: Build the long-form detail page

**Files:**
- Create: `apps/consumer/src/pages/LongformDetail.tsx`
- Modify: `apps/consumer/src/App.tsx`
- Reuse patterns from: `apps/consumer/src/pages/DramaDetail.tsx`
- Test: `apps/consumer/test/longform-detail.test.ts`

**Steps:**
1. Write failing pure tests for movie single-play action and series episode selection.
2. Implement loading, retry, not-found, synopsis, metadata, landscape hero, poster, season/episode list, VIP lock state, and report action using existing patterns.
3. Avoid a new component system; keep the existing centered layout but allow a wider landscape content container where required.
4. Run targeted tests and Consumer typecheck; expect PASS.
5. Commit.

### Task 9: Build the landscape watch page

**Files:**
- Create: `apps/consumer/src/pages/LongformWatch.tsx`
- Modify: `apps/consumer/src/App.tsx`
- Reuse stream/error/progress patterns from: `apps/consumer/src/pages/Watch.tsx`
- Test: `apps/consumer/test/longform-watch.test.ts`

**Steps:**
1. Write failing tests for selected episode, next episode, VIP denial, and progress percentage.
2. Implement a native landscape `<video>` flow; do not use `VerticalShortPlayer`.
3. Reuse existing stream URL handling, report dialog, local progress, auth return path, and purchase modal.
4. Run targeted tests, Consumer typecheck, and build; expect PASS.
5. Commit.

### Task 10: Image allowlist, production sync, and smoke verification

**Files:**
- Modify: `apps/consumer/public/_worker.js` only for live-observed WeTV/MovieBox poster/stream hosts.
- Modify: `apps/consumer/src/lib/img.ts` only if live poster host matching requires it.
- Test: smallest Worker allowlist/key test beside existing worker tests.

**Steps:**
1. Extract unique hostnames from sanitized live responses and write failing allowlist tests.
2. Add only exact registrable domains required; retain HTTPS and SSRF guards.
3. Run API tests/typecheck, Consumer tests/typecheck/build, and `git diff --check`.
4. Deploy API and Consumer using existing documented commands without printing secrets.
5. Seed/sync WeTV and MovieBox.
6. Smoke production: Home contains both shelves; provider pages load; one film and one series open dedicated detail; episode playback returns a playable landscape stream; poster proxy returns an image.
7. Review `git status`/diff, confirm unrelated untracked files remain untouched, then push scoped commits.
