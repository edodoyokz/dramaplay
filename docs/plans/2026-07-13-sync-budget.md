# Sync Budget Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make daily provider sync finish under a soft time/item budget without dropping catalog freshness or corrupting episode rows.

**Architecture:** Pure budget helpers + small changes to `syncProvider`: select summaries, prioritize incomplete titles for deep-fill, cap new episode rows per title, stop deep-fill when time budget hits, and remove sync-time `resolveStream` subtitle seeding. Workflow sets env defaults. No DB migration.

**Tech Stack:** TypeScript, existing `tsx` + `node:test` / assert tests in `apps/api/test`, GitHub Actions, pnpm.

**Design:** `docs/plans/2026-07-13-sync-budget-design.md`

---

### Task 1: Budget pure helpers + failing tests

**Files:**
- Create: `apps/api/src/sync/budget.ts`
- Create: `apps/api/test/sync-budget.test.ts`

**Step 1: Write the failing test**

```ts
// apps/api/test/sync-budget.test.ts
import assert from "node:assert/strict";
import {
  defaultSyncBudgets,
  selectDeepFillCandidates,
  takeEpisodeInsertBatch,
  type DeepFillCandidate,
} from "../src/sync/budget";

assert.deepEqual(defaultSyncBudgets("wetv"), {
  maxItems: 20,
  maxNewEpisodeDramas: 5,
  maxEpisodesPerDrama: 80,
  timeBudgetMs: 720_000,
});
assert.equal(defaultSyncBudgets("shortmax").maxItems, 80);
assert.equal(defaultSyncBudgets("moviebox").maxNewEpisodeDramas, 5);

const candidates: DeepFillCandidate[] = [
  { providerDramaId: "a", kind: "complete" },
  { providerDramaId: "b", kind: "new" },
  { providerDramaId: "c", kind: "incomplete" },
  { providerDramaId: "d", kind: "new" },
  { providerDramaId: "e", kind: "incomplete" },
];
assert.deepEqual(
  selectDeepFillCandidates(candidates, 3).map((c) => c.providerDramaId),
  ["c", "e", "b"],
);

const nums = [1, 2, 3, 4, 5, 6];
assert.deepEqual(takeEpisodeInsertBatch(nums, new Set([1, 2]), 2), [3, 4]);
assert.deepEqual(takeEpisodeInsertBatch(nums, new Set([1, 2, 3, 4, 5, 6]), 10), []);

console.log("sync-budget tests passed");
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm exec tsx test/sync-budget.test.ts`  
Expected: FAIL module not found / export missing

**Step 3: Minimal implementation**

```ts
// apps/api/src/sync/budget.ts
export type SyncBudgets = {
  maxItems: number;
  maxNewEpisodeDramas: number;
  maxEpisodesPerDrama: number;
  timeBudgetMs: number;
};

const LONGFORM = new Set(["wetv", "moviebox"]);

export function defaultSyncBudgets(providerCode: string): SyncBudgets {
  if (LONGFORM.has(providerCode)) {
    return {
      maxItems: 20,
      maxNewEpisodeDramas: 5,
      maxEpisodesPerDrama: 80,
      timeBudgetMs: 720_000,
    };
  }
  return {
    maxItems: 80,
    maxNewEpisodeDramas: 10,
    maxEpisodesPerDrama: 120,
    timeBudgetMs: 720_000,
  };
}

export function resolveSyncBudgets(
  providerCode: string,
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<SyncBudgets> = {},
): SyncBudgets {
  const d = defaultSyncBudgets(providerCode);
  const num = (k: string, fallback: number) => {
    const v = env[k];
    if (v == null || v === "") return fallback;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    maxItems: overrides.maxItems ?? num("SYNC_MAX_ITEMS", d.maxItems),
    maxNewEpisodeDramas:
      overrides.maxNewEpisodeDramas ?? num("SYNC_MAX_NEW_EPISODE_DRAMAS", d.maxNewEpisodeDramas),
    maxEpisodesPerDrama:
      overrides.maxEpisodesPerDrama ?? num("SYNC_MAX_EPISODES_PER_DRAMA", d.maxEpisodesPerDrama),
    timeBudgetMs: overrides.timeBudgetMs ?? num("SYNC_TIME_BUDGET_MS", d.timeBudgetMs),
  };
}

export type DeepFillKind = "incomplete" | "new" | "complete";
export type DeepFillCandidate = { providerDramaId: string; kind: DeepFillKind };

export function selectDeepFillCandidates(
  candidates: DeepFillCandidate[],
  maxNewEpisodeDramas: number,
): DeepFillCandidate[] {
  const rank = { incomplete: 0, new: 1, complete: 2 } as const;
  return [...candidates]
    .filter((c) => c.kind !== "complete")
    .sort((a, b) => rank[a.kind] - rank[b.kind])
    .slice(0, Math.max(0, maxNewEpisodeDramas));
}

export function takeEpisodeInsertBatch(
  episodeNumbers: number[],
  have: Set<number>,
  maxNew: number,
): number[] {
  const missing = episodeNumbers.filter((n) => !have.has(n)).sort((a, b) => a - b);
  return missing.slice(0, Math.max(0, maxNew));
}

export function isTimeBudgetExhausted(startedAtMs: number, timeBudgetMs: number, nowMs = Date.now()): boolean {
  return nowMs - startedAtMs >= timeBudgetMs;
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm exec tsx test/sync-budget.test.ts`  
Expected: `sync-budget tests passed`

**Step 5: Commit**

```bash
git add apps/api/src/sync/budget.ts apps/api/test/sync-budget.test.ts
git commit -m "feat(sync): add budget helpers for daily provider sync"
```

---

### Task 2: Wire budgets into `syncProvider` (no subtitle seed)

**Files:**
- Modify: `apps/api/src/sync/sync.ts`
- Modify: `apps/api/scripts/sync-providers.ts` (pass-through only if needed)
- Test: `apps/api/test/sync-fetch-all.test.ts` (existing; keep green)
- Create/extend: `apps/api/test/sync-provider-budget.test.ts` for pure integration of selection inside exported helpers if logic stays in budget.ts; otherwise unit-test via small extracted functions.

**Step 1: Failing test for incomplete prioritization already in Task 1.**  
Add one behavioral note test if any pure function remains in `sync.ts`. Prefer keeping all pure logic in `budget.ts`.

**Step 2: Change `syncProvider` options**

```ts
options: {
  fast?: boolean;
  searchKeywords?: string[];
  maxItems?: number;
  consumerUrl?: string;
  maxNewEpisodeDramas?: number;
  maxEpisodesPerDrama?: number;
  timeBudgetMs?: number;
} = {}
```

Resolve:

```ts
const budgets = resolveSyncBudgets(providerCode, process.env, {
  maxItems: options.maxItems,
  maxNewEpisodeDramas: options.maxNewEpisodeDramas,
  maxEpisodesPerDrama: options.maxEpisodesPerDrama,
  timeBudgetMs: options.timeBudgetMs,
});
const selectedItems = items.slice(0, budgets.maxItems);
```

**Step 3: Deep-fill loop**

After metadata upsert for each selected item, classify:

```ts
// existingEpisodeCount from dramas.episodeCount (metadata)
// haveCount = actual episode rows for dramaId (query once when deciding)
kind =
  haveCount === 0 ? (existing.length ? "incomplete" : "new")
  : existingEpisodeCount > 0 && haveCount < existingEpisodeCount ? "incomplete"
  : options.fast ? "complete"
  : "incomplete"; // non-fast still refreshes
```

Collect candidates while upserting metadata, then:

```ts
const toDeepFill = selectDeepFillCandidates(candidates, budgets.maxNewEpisodeDramas);
let deepFilled = 0;
let deepFillSkippedBudget = 0;
let episodesCapped = 0;
const startedMs = startedAt.getTime();

for (const cand of toDeepFill) {
  if (isTimeBudgetExhausted(startedMs, budgets.timeBudgetMs)) {
    deepFillSkippedBudget += toDeepFill.length - deepFilled;
    break;
  }
  // fetchEpisodes + insert only takeEpisodeInsertBatch(...)
  // if missing after insert still remain → episodesCapped++
  deepFilled++;
}
```

**Step 4: Remove free-episode subtitle `resolveStream` block** (lines that insert into `subtitles` during sync). Keep free/VIP threshold updates.

**Step 5: Console log counters**

```ts
console.log(
  `[sync] ${providerCode}: deepFilled=${deepFilled} skippedBudget=${deepFillSkippedBudget} episodesCapped=${episodesCapped}`,
);
```

Status `partial` when `deepFillSkippedBudget > 0` or `errorCount > 0`.

**Step 6: Run tests**

```bash
cd apps/api && pnpm exec tsx test/sync-budget.test.ts
cd apps/api && pnpm exec tsx test/sync-fetch-all.test.ts
# any existing sync tests
```

Expected: pass

**Step 7: Commit**

```bash
git add apps/api/src/sync/sync.ts apps/api/scripts/sync-providers.ts apps/api/test/
git commit -m "feat(sync): apply item/time budgets and drop sync subtitle seed"
```

---

### Task 3: Workflow env defaults

**Files:**
- Modify: `.github/workflows/daily-sync.yml`

**Step 1: Set env on Sync provider step**

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  PROVIDER_BASE_URL: ${{ secrets.PROVIDER_BASE_URL }}
  PROVIDER_API_TOKEN: ${{ secrets.PROVIDER_API_TOKEN }}
  CONSUMER_URL: "https://dramaplay.my.id"
  SYNC_FAST: "1"
  # Per-provider defaults live in code (longform vs shortform).
  # Override globally only when needed:
  # SYNC_MAX_ITEMS: "80"
  # SYNC_MAX_NEW_EPISODE_DRAMAS: "10"
  # SYNC_MAX_EPISODES_PER_DRAMA: "120"
  SYNC_TIME_BUDGET_MS: "720000"
```

Keep `timeout-minutes: 25`. No schedule change.

**Step 2: Commit**

```bash
git add .github/workflows/daily-sync.yml
git commit -m "chore(ci): set daily sync soft time budget"
```

---

### Task 4: Manual verification

**Step 1: Dry-run local against production DB only if user supplies intent; otherwise unit tests + typecheck.**

Safe verification without long prod sync:

```bash
cd apps/api && pnpm exec tsx test/sync-budget.test.ts
cd /home/luckyn00b/Documents/PROJECT/dramaplay && pnpm --filter @dramaplay/api exec tsc --noEmit 2>&1 | tail -20
```

Optional live smoke (small):

```bash
cd apps/api
SYNC_FAST=1 SYNC_MAX_ITEMS=5 SYNC_MAX_NEW_EPISODE_DRAMAS=1 SYNC_MAX_EPISODES_PER_DRAMA=20 \
  pnpm exec tsx scripts/sync-providers.ts moviebox --max 5
```

Expected: finishes quickly; log shows budget counters; no hang on subtitle resolves.

**Step 2: Final commit if smoke tweaks needed; else push.**

```bash
git push origin main
```

---

### Task 5: Docs touch (optional, one paragraph)

**Files:**
- Modify: `docs/deploy/production-deploy.md` or `README.md` only if sync ops are documented there — one short “Daily sync budgets” bullet. Skip if no existing sync ops section.

---

## Done when

- [ ] `budget.ts` helpers tested
- [ ] `syncProvider` uses budgets, prioritizes incomplete, caps episodes
- [ ] Sync-time subtitle `resolveStream` removed
- [ ] Workflow has soft time budget env
- [ ] Tests green; no new dependency
- [ ] Commits on main (or PR) with evidence of test run
