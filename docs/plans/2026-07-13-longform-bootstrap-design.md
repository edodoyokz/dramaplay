# Fast Long-form Catalog Bootstrap Design

## Goal

Fill the complete WeTV and MovieBox catalogs as quickly as their upstream APIs permit, while keeping normal daily sync bounded to five minutes.

## Current state

Production has already discovered and filled almost all available long-form data:

| provider | titles | complete | episodes | upstream-empty |
|---|---:|---:|---:|---:|
| WeTV | 180 | 178 | 7,675 | 2 |
| MovieBox | 191 | 190 | 4,611 | 1 |

The remaining empty titles are `wetv-godspeed`, `wetv-monster-next-door`, and `moviebox-animal-farm`. The provider returned no episodes for these titles. A longer timeout cannot manufacture missing upstream data.

The current daily implementation also slices summaries before metadata processing. That is acceptable for routine bounded work but is the wrong mechanism for one-time initial population.

## Decision

Use two explicit modes:

1. **Bootstrap mode (manual/local, one-time):** discover and upsert every title, repeatedly deep-fill only incomplete titles in short passes, and stop when a pass makes no progress.
2. **Maintenance mode (scheduled):** keep normal daily discovery and incomplete-first deep-fill under a five-minute soft budget.

No queue table, new dependency, provider concurrency, or persistent rotation cursor is needed for the current catalog. The database itself is the durable checkpoint: existing episode rows and `dramas.episode_count` identify remaining work after interruption.

## Bootstrap flow

A dedicated script runs one provider at a time:

```text
for wetv, moviebox:
  pass 1:
    sync all discovered metadata
    deep-fill bounded incomplete titles
  subsequent passes:
    repeat incomplete fill
    stop when episodeNew == 0
    or no budget-skipped useful work remains
    or max pass guard is reached
```

Each pass:

- uses `SYNC_FAST=1`, so complete titles are not fetched again;
- sets `maxItems` high enough to include the full discovered catalog;
- limits each provider invocation to a five-minute soft budget;
- allows up to 20 incomplete titles and 500 episode inserts per title;
- sleeps three seconds before the next pass;
- prints pass and cumulative totals;
- exits successfully when no further episode rows can be added;
- reports upstream-empty titles as unresolved rather than looping forever.

The script has a finite default maximum of 20 passes. CLI flags may lower the limit but do not permit an infinite loop.

## Maintenance flow

Daily WeTV/MovieBox defaults become:

| setting | value |
|---|---:|
| soft time budget | 300,000 ms (5 min) |
| metadata summaries | all discovered long-form titles (default 250 ceiling) |
| episode titles/run | 10 |
| episode inserts/title | 200 |
| concurrency | 1 |

All metadata remains cheap relative to episode calls, so processing the complete 180–191 title summary set prevents catalog discovery loss. Episode reconciliation remains serial and incomplete-first.

The GitHub Actions hard timeout stays at 25 minutes. The application soft budget ends useful work before that ceiling.

## Empty upstream titles

A title with an empty `fetchEpisodes` response counts as attempted but adds no rows. Bootstrap stops after a no-progress pass, listing such titles for later upstream recheck. Daily maintenance can retry them; they cannot block other incomplete titles because the daily candidate cap is larger than the known empty set.

A persisted empty cooldown is deferred. Add it only if production logs show empty titles materially consuming the five-minute maintenance budget.

## Error handling

- A broken shelf remains a soft failure; other shelves still contribute titles.
- One title failure increments errors and does not abort its provider pass.
- Top-level provider failure is reported and the bootstrap process exits non-zero.
- Database uniqueness constraints preserve idempotency across repeated or interrupted passes.
- The bootstrap script refuses unknown providers and only defaults to `wetv moviebox`.

## Verification

1. Unit tests prove long-form maintenance defaults are `250 / 10 / 200 / 300000`.
2. Argument tests prove bootstrap defaults, finite max passes, and provider allowlisting.
3. Progress-policy tests prove another pass is requested only when rows were added and useful backlog remains.
4. Run the bootstrap script against production data with a small pass cap first.
5. Run full bootstrap and compare database counts before/after.
6. Confirm the final no-progress pass exits instead of retrying indefinitely.
7. Run API and consumer long-form smoke checks after completion.

## Success criteria

- Every WeTV/MovieBox title discoverable from current upstream feeds exists in Dramaplay.
- Every episode returned by upstream is inserted without duplicates.
- Bootstrap resumes safely after interruption and terminates on no progress.
- Known upstream-empty titles are reported clearly and do not cause an endless run.
- Routine daily sync stops scheduling new work at five minutes.

## Deferred

- Parallel provider calls.
- Queue/job tables.
- Persistent cursor and empty-title cooldown columns.
- Attempts to synthesize episodes for titles whose provider response is empty.
