# Evidence: WeTV + MovieBox Indonesian subtitle & multi-season playback

Date (UTC): 2026-07-12T18:53:15Z  
Branch: `feat/wetv-moviebox-indonesian`  
Worktree: `.worktrees/wetv-moviebox-indonesian`

## Automated verification

| Check | Command | Result |
|---|---|---|
| Focused API | `pnpm --filter @dramaplay/api test -- test/wetv-provider.test.ts test/moviebox-provider.test.ts test/longform-contract.test.ts test/sync-episodes.test.ts test/sync-budget.test.ts test/watch.test.ts` | **45/45 PASS** |
| Full API | `pnpm --filter @dramaplay/api test` | **136/136 PASS** (25 files) |
| Shared/DB/API/Consumer typecheck | `pnpm typecheck` | **PASS** (shared, db, admin, api, consumer) |
| Workspace build | `pnpm build` | **PASS** (admin + consumer) |
| Worker stream | `node apps/consumer/test/worker-stream.test.mjs` | **PASS** (allowlist + SRT/VTT flatten + fail-closed 502 cases + /img) |
| Content route | `pnpm exec vitest run apps/consumer/test/content-route.test.ts` | **3/3 PASS** |
| Local engagement | `pnpm --filter @dramaplay/db exec tsx ../../apps/consumer/test/local-engagement.test.ts` | **PASS** |
| Longform playback | `pnpm --filter @dramaplay/db exec tsx ../../apps/consumer/test/longform-playback.test.ts` | **PASS** |
| Whitespace | `git diff --check` | **PASS** |
| Protected files | `git diff -- apps/api/src/sync/budget.ts apps/api/test/sync-budget.test.ts .github/workflows/daily-sync.yml pnpm-lock.yaml package.json` | **empty** (unchanged) |

## Requirement → artifact map

| Requirement | Artifact | Evidence |
|---|---|---|
| WeTV language Indonesia | `apps/api/src/providers/sapimu/wetv.ts`, `test/wetv-provider.test.ts` | all ops assert `lang=id&country=ID`; 13 tests |
| MovieBox language Indonesia | `apps/api/src/providers/sapimu/moviebox.ts`, `test/moviebox-provider.test.ts` | search/detail/episodes/play carry `lang=id`; 9 tests |
| Indonesian subtitle correctness | both adapters + `apps/api/src/routes/watch.ts` | accept `id`/`id-id`/`in-id`/`Indonesia`/`Bahasa Indonesia`; reject en/unknown; omit keys when missing |
| Playback without Indonesian subtitle | watch tests + LongformWatch | no invented `id`; no `<track>` when absent |
| WeTV playable (proxy) | `apps/consumer/public/_worker.js` + worker tests | flatten `.vtt.m3u8`; invalid/empty/failed → **502** |
| MovieBox playable (proxy) | worker SRT→VTT | valid SRT 200; failed/empty/invalid 502 |
| MovieBox multi-season | schema + migration + sync + watch + UI | composite `(season, episode)`; next via tuple order; detail groups by season |
| Episode discovery | `apps/api/src/sync/episodes.ts` | fast MovieBox may fill remaining budget with complete titles |
| Recovery/retry | `apps/consumer/src/lib/longform-playback.ts` | one bounded `startLoad`/`recoverMediaError` then fail; cleanup idempotent |
| Android + desktop target | — | **not verified live** (no local stack + browser smoke this run) |

## Migration preflight (production DB, read-only)

- `season_number` **absent** before migrate (journal has migrations 0–3 only).
- Pre-existing MovieBox identity collisions after planned backfill: **619 groups / 2301 rows / 78 dramas** (same `provider_episode_id` inserted many times with distinct titles).
- Dedupe impact: keep oldest row per `(drama_id, season_number, episode_number)` → **delete ~1682**, keep **181799**.
- Migration `0004_season_episode_identity.sql` updated to: add column → MovieBox season backfill → **dedupe DELETE** → duplicate guard → checks → unique index.
- FKs on `episodes` all `ON DELETE CASCADE` (episode_providers, stream_resolve_cache, subtitles, episode_likes, watch_progress).

## Live browser smoke (Task 12)

**Not verified** in this session:

- No disposable/staging DB container available (`docker`/`psql` missing).
- Production migration not yet applied at evidence write time.
- Chrome desktop/Android playback screenshots and `readyState`/`playing` measurements not collected.

Do not treat fixture/unit results as live playback proof.

## Notes

- User later authorized: complete remaining work, run migration, merge to main, redeploy.
- No dependency / lockfile changes.
