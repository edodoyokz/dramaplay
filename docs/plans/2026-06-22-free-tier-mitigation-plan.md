# Free Tier Mitigation — Implementation Plan

**Source audit:** `docs/reports/2026-06-22-free-tier-capacity-audit.md`
**Date:** 2026-06-22
**Goal:** Keep Dramaplay inside Cloudflare Workers (10ms CPU, 100K req/day) and Supabase (500MB) free limits up to ~1,000 DAU, with zero new dependencies.

---

## Findings beyond the audit (verified in code)

| # | Issue | File | Note |
|---|-------|------|------|
| A | `createDb()` opens a new `postgres({max:5})` pool **per call** | `packages/db/src/client.ts` | watch path calls it 2-3×/request |
| B | `watch.ts` calls `createDb` in handler **and** in `streamResponse` | `apps/api/src/routes/watch.ts` | redundant pool + redundant `dramas` lookup possible |
| C | crons commented out → `scheduled()` can't run keep-alive/cleanup | `apps/api/wrangler.toml` | blocked on workers.dev subdomain per existing `ponytail:` note |
| D | `/health` returns static JSON, no DB probe | `apps/api/src/index.ts` | audit §6.5 wants a real probe |

The CPU fix in the audit (Promise.all) helps, but **B is the cheaper win**: one pool reuse + dropping the duplicate query removes more CPU than parallelizing. Do both.

---

## Phase P0 — Before launch

### Task 1 — Reuse one DB connection per request
**File:** `apps/api/src/routes/watch.ts`
- Create `db` once in the handler, pass it into `streamResponse(db, env, drama, episode)`.
- Pass the same `db` into `isUserVip` (add optional `db` param to `entitlements.ts`, fall back to `createDb` if absent — keeps other callers working).
- Skipped: a global connection cache. Workers isolates are short-lived; per-request reuse is enough. Add when profiling shows pool setup dominates.

**Check:** existing watch flow still returns `streamUrl` for a free episode (manual curl or existing test).

### Task 2 — Parallelize independent watch queries
**File:** `apps/api/src/routes/watch.ts` (`streamResponse`)
- The provider lookup → `resolveStream` is a dependency chain (need `primary` before resolving). But `nextEpisode` and `subtitles` are independent of the stream and of each other.
- Run `provider` (provider+primary) resolution and `Promise.all([nextEpisode, subtitles])` concurrently. `nextEpisode`+`subtitles` only need `episode.id`/`drama.id`, already known.
- Target: 6-8ms CPU (audit §6.1A).

### Task 3 — Memory cache the watch response (highest impact)
**File:** `apps/api/src/routes/watch.ts`
- Module-level `Map<string, {data, ts}>`, key `${slug}:${n}`, 60s TTL.
- **Only cache free (`accessType !== "vip"`) responses** — VIP must re-check entitlement every request. Cache after successful resolve, return early on hit.
- Cap the map (e.g. clear/evict when `size > 500`) so a long-lived isolate can't leak. `ponytail: naive size cap, switch to LRU if eviction churn shows up`.
- Skipped: Cloudflare Cache API / KV. In-isolate Map is 0ms and zero-config; revisit if hit rate across isolates is poor.

**Check:** second request for same free episode within 60s returns identical body without a DB round-trip (assert via a hit counter in a `__main__`/test or log).

### Task 4 — Analytics retention (stop the 500MB bomb)
**Two parts:**
1. SQL cleanup query, run from cron (Task 6):
   ```sql
   DELETE FROM analytics_events WHERE created_at < NOW() - INTERVAL '7 days';
   ```
   Add as a helper in `apps/api/src/sync/` or inline in `scheduled()`.
2. Skipped for now: moving events out of Postgres (Logpush/aggregation). 7-day TTL keeps it under ~30MB at 1K DAU — enough. Add aggregation when DAU > 2K.

---

## Phase P1 — Week 1

### Task 5 — Catalog response cache
**File:** `apps/api/src/routes/catalog.ts`
- Module-level cache per endpoint, 120s TTL: `/trending`, `/new`, `/dramas/:slug` (key by slug).
- Same size-cap discipline as Task 3.
- Leave `/search` uncached (unbounded keys).

### Task 6 — Enable cron: keep-alive + analytics cleanup
**Files:** `apps/api/wrangler.toml`, `apps/api/src/index.ts`
- Uncomment `[triggers] crons` **once the workers.dev subdomain exists** (the blocker named in the existing `ponytail:` comment). This is the one manual prerequisite — confirm in CF dashboard first.
- In `scheduled()`: add `await db.execute(sql\`SELECT 1\`)` keep-alive (anti-pause, audit §6.4) and the Task 4 DELETE. Keep the existing provider sync.
- Suggested schedule: keep-alive/cleanup daily, sync on existing cadence.

### Task 7 — Real `/health` probe
**File:** `apps/api/src/index.ts`
- Add a `SELECT 1` with try/catch, return `{ok, db: "up"|"down"}`. No `process.memoryUsage` (not meaningful in Workers).

---

## Phase P2 — Defer (one line each, do when triggered)

- Pakasir limits: confirm from their docs before relying on webhook volume.
- Request-counter middleware: add only if approaching 100K/day.
- Load test (k6) against watch: add before a marketing push.
- **Upgrade trigger:** DAU > 500 or any Error 1102 → CF Workers Paid ($5). This is the real fix; the above buys runway, not infinity.

---

## Order of work
1 → 2 → 3 (watch CPU, the thing that breaks first)
4 + 6 (analytics, the thing that breaks second — needs cron)
5, 7 (polish)

Verify each task with `pnpm --filter @dramaplay/api build`/typecheck before moving on. Caches and the DELETE path each leave one runnable assert.
