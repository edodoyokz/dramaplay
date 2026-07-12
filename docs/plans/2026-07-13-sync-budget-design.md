# Daily Provider Sync Budget Design

## Goal

Keep daily provider sync complete and correct without Actions timeouts or API thrash: every scheduled run finishes under a soft time budget, catalog stays fresh, and episode fill progresses across runs instead of flooding a single job.

## Problem (measured)

Recent production `sync_logs` (sample):

| provider | drama_new | episode_new | secs |
|---|---:|---:|---:|
| shortmax | 25 | 1416 | 350 |
| pinedrama | 10 | 416 | 391 |
| moviebox | 15 | 636 | 144 |
| netshort | 18 | 912 | 108 |

Root costs in `apps/api/src/sync/sync.ts`:

1. New / empty-episode titles always call `fetchEpisodes` for the full list.
2. Free-episode subtitle seed calls `resolveStream` once per free episode.
3. Drama processing is serial; no per-run item/time budget.
4. Daily workflow sets `SYNC_FAST=1` but no `maxItems`, so large home feeds still attempt full deep-fill on every new title.

`SYNC_FAST` already skips titles with `episodeCount > 0`. That is not enough when many new titles appear in one day.

## Decision

**Budget-gated daily sync (option B1) with the cheapest B2 piece:**

- Daily still inserts/updates catalog metadata for selected summaries.
- Daily deep-fills only a bounded set of incomplete / new titles.
- Daily does **not** pre-resolve subtitles; free + VIP subtitles come from existing watch write-through.
- Incomplete titles (`have < want` or `have = 0`) are prioritized on later runs until full.
- No new queue table, Workers cron, or dependency.

## Architecture

```
GitHub Actions (1 provider / hour)
  → sync-providers.ts
    → syncProvider(db, code, opts)
         1. fetchAllProviderSummaries (forYou/trending/latest/vip [+search])
         2. selectSummaries(items, maxItems)
         3. optional poster warm (pinedrama only path today)
         4. upsert drama + drama_providers metadata for selected
         5. choose deep-fill candidates (incomplete first, then new)
            under maxNewEpisodeDramas + time budget
         6. for each candidate: fetchEpisodes, insert missing rows,
            recompute free/VIP threshold, cap per-drama episode inserts
         7. write sync_logs with budget counters
```

### Budgets (env, defaults)

| env | default | meaning |
|---|---:|---|
| `SYNC_FAST` | `1` (workflow) | Skip deep-fill when drama already has `episodeCount > 0` **and** is not incomplete |
| `SYNC_MAX_ITEMS` | shortform `80`, longform `20` | Max summaries processed for metadata upsert |
| `SYNC_MAX_NEW_EPISODE_DRAMAS` | shortform `10`, longform `5` | Max titles that call `fetchEpisodes` this run |
| `SYNC_MAX_EPISODES_PER_DRAMA` | shortform `120`, longform `80` | Max new episode rows inserted per title this run |
| `SYNC_TIME_BUDGET_MS` | `720000` (12 min) | Stop scheduling more deep-fills; finish current title gracefully |

Provider class for defaults:

- **longform:** `wetv`, `moviebox`
- **shortform:** all other enabled providers in daily-sync

CLI `--max N` continues to override `SYNC_MAX_ITEMS`. Explicit option fields on `syncProvider` override env (tests / manual runs).

### Selection rules

1. Build unique summary list (existing `fetchAllProviderSummaries`).
2. Apply `maxItems` slice (stable order from Map insertion; no random shuffle).
3. Upsert all selected drama metadata even if deep-fill budget is exhausted.
4. Deep-fill eligibility:
   - always if no episode rows yet, or
   - if not fast mode, or
   - if incomplete (`existing episode rows < dramas.episodeCount` when count known, or rows == 0).
5. Order deep-fill candidates: incomplete first, then brand-new, then other eligible.
6. Take first `maxNewEpisodeDramas` that fit remaining time budget.
7. When inserting episodes for a title, insert missing numbers only, sorted ascending, up to `maxEpisodesPerDrama` new rows. Remaining missing eps wait for next run (still incomplete → prioritized).

### Subtitle policy

- Remove daily free-episode `resolveStream` subtitle seeding from the sync hot path.
- Watch route write-through remains the source of truth for `subtitles` rows.
- Rationale: N stream resolves dominate runtime and are unnecessary for catalog correctness; browser already receives subtitle URLs at play time from the provider adapter.

### Concurrency

- Keep drama deep-fill **serial** in v1 (smallest correct diff; avoids provider rate-limit spikes).
- Time budget alone is enough to beat Actions 25m kills given measured ~2–6s per title once subtitle resolves are gone.
- Optional later: concurrency 2–3 if logs show under-utilization; not in first ship.

### Workflow

`.github/workflows/daily-sync.yml`:

- Keep staggered 1-provider crons.
- Keep `SYNC_FAST=1`.
- Set budget envs explicitly (readable defaults, not magic).
- Keep `timeout-minutes: 25` as hard ceiling; soft budget exits earlier with `partial` when work remains.
- PineDrama poster backfill stays post-sync on that provider only.

### Logging

Extend `SyncResult` / log payload (console + `sync_logs` where columns already fit; extra counters in console / `errorDetail` JSON only if no schema change desired):

- `dramaNew`, `dramaUpdated`, `episodeNew`, `errorCount` (existing)
- `deepFilled`, `deepFillSkippedBudget`, `episodesCapped`

Status:

- `success` — no errors and no budget skip with remaining incomplete candidates
- `partial` — errors > 0 **or** budget exhausted with remaining deep-fill work
- `failed` — top-level exception

No DB migration required if extra counters stay in console + optional `errorDetail` JSON string. Prefer console-only counters in v1 to avoid schema churn.

## Out of scope

- Fixing goodshort / reelshort / dramawave adapter auth failures (separate).
- Persistent job queue table or Workers cron.
- Parallel drama deep-fill.
- Full non-fast weekly “refresh all episodes” job.
- Changing free/VIP threshold formula.
- Legal / billing / consumer UI.

## Success criteria

1. Typical daily provider run finishes in **< 10 minutes**; soft stop by **12 minutes**.
2. No Actions job killed solely because episode flood exceeded 25 minutes.
3. New titles appear on Home within one daily slot; episode lists complete within a few subsequent runs for large longform titles.
4. Watch still returns subtitles for MovieBox/WeTV via existing adapter + proxy paths.
5. Unit tests cover budget selection, incomplete prioritization, episode cap, and subtitle-seed removal.
6. Manual dry-run with `SYNC_MAX_NEW_EPISODE_DRAMAS=2` on a large provider proves early exit without data corruption.

## Risks

| risk | mitigation |
|---|---|
| Longform titles temporarily show partial episode lists | incomplete prioritization next run; cap is per-run not permanent |
| Subtitles missing until first free-episode watch | accepted; write-through already used for VIP |
| Budget too tight → catalog lag | env knobs; raise defaults after first week of logs |
| `episodeCount` metadata wrong → false complete | treat `have == 0` as incomplete always; update count from inserted rows as today |

## Approval

Approved approach: **B1 + drop sync-time subtitle resolve + incomplete prioritization**. Defaults as table above unless changed at implementation time.
