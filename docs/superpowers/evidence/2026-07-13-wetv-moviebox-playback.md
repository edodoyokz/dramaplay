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

## Migration (production)

Command: `DATABASE_URL=… pnpm --filter @dramaplay/db db:migrate`  
Result: **PASS** (journal id 5 / tag `0004_season_episode_identity`)

Preflight:
- `season_number` absent; migrations 0–3 present.
- MovieBox identity collisions after planned backfill: **619 groups / ~2301 rows / 78 dramas**.
- Reelshort `episode_number=0` rows: **86** (all had episode 1 already).
- FKs on `episodes` all `ON DELETE CASCADE`.

Migration SQL final order: add column → MovieBox season backfill → delete `episode_number <= 0` → dedupe keep oldest → duplicate guard → checks → unique index.

Post-migrate verify:
- column `season_number` NOT NULL default 1
- unique index `episodes_drama_season_episode_uq` present
- checks `episodes_season_nonnegative_ck`, `episodes_episode_positive_ck` present
- duplicate groups: **0**
- episode count: **181713** (was 183481)
- multi-season MovieBox samples remain (e.g. love-island-usa seasons 3 / 41 eps)
- probe insert S1E1 + S2E1 succeeded then rolled back via drama delete

## Live browser smoke (Task 12)

**Not verified** in this session:

- No disposable/staging stack for Playwright Chrome desktop/Android.
- No `readyState`/`playing` measurements or screenshots collected.

Do not treat fixture/unit results as live playback proof.

## Notes

- User authorized: complete remaining work, run migration, merge to main, redeploy.
- No dependency / lockfile changes.

## Production deploy + live API smoke (post-merge)

Date (UTC): 2026-07-12T18:58:00Z approx

Deploy:
- API worker `dramaplay-api` via local wrangler: **OK** (version `2646f49b-a8e7-4ca3-b60d-a1c5890fea53`, route `api.dramaplay.my.id/*`)
- Consumer Pages `dramaplay-consumer`: **OK** (`https://99bd927e.dramaplay-consumer.pages.dev`)
- Admin Pages `dramaplay-admin`: **OK** (`https://2a4e7588.dramaplay-admin.pages.dev`)
- GitHub Actions deploys initially failed: missing `CLOUDFLARE_*` secrets + Node 20 vs Wrangler 4. Fixed: secrets restored; workflows on Node 22 (`7536a9f`). CI **success**. Manual re-deploy used because deploy workflows lack `workflow_dispatch` and only path-filter on app paths.

Live checks (no signed URL leakage):
- `GET /health` → 200 `db:up`
- `GET https://dramaplay.my.id/` → 200
- MovieBox multi-season catalog `GET /catalog/dramas/moviebox-love-island-usa` → 41 eps, seasons `[1,2,4]`
- Watch S1E1 → 200, `streamType=mp4`, `subtitleLanguage=id`, next `{1,2}`
- Watch S2E23 → 200, distinct season, next `{2,24}`
- Subtitle proxy `/stream?u=…srt` → 200 `text/vtt` body starts `WEBVTT`, Indonesian cue text present
- WeTV sample `wetv-fengmen-village-horror` S1E1 → 200, `streamType=m3u8`, `subtitleLanguage=id`, subtitle proxy OK

Still not verified:
- Chrome desktop/Android actual `<video>` `readyState`/`playing` screenshots
- Forced media-error recovery click path in browser
