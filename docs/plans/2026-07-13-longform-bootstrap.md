# Fast Long-form Catalog Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fully populate every WeTV and MovieBox title/episode currently returned upstream, then maintain both catalogs with five-minute daily sync runs.

**Architecture:** Reuse the existing idempotent `syncProvider` and database completeness checks. Add a finite local bootstrap loop that repeats bounded incomplete-first passes until no rows are added; daily sync processes all long-form metadata but caps episode reconciliation under five minutes.

**Tech Stack:** TypeScript, Node.js 22, pnpm, Vitest, Drizzle/PostgreSQL, GitHub Actions.

---

### Task 1: Set five-minute long-form maintenance defaults

**Files:**
- Modify: `apps/api/src/sync/budget.ts`
- Modify: `apps/api/test/sync-budget.test.ts`

**Step 1: Write the failing test**

Change the long-form default assertion to:

```ts
expect(defaultSyncBudgets("wetv")).toEqual({
  maxItems: 250,
  maxNewEpisodeDramas: 10,
  maxEpisodesPerDrama: 200,
  timeBudgetMs: 300_000,
});
expect(defaultSyncBudgets("moviebox")).toEqual(
  defaultSyncBudgets("wetv"),
);
```

This ceiling covers the measured 180 WeTV and 191 MovieBox titles without an unbounded metadata loop.

**Step 2: Run the test to verify it fails**

Run:

```bash
cd apps/api
pnpm exec vitest run test/sync-budget.test.ts
```

Expected: FAIL because current values are `20 / 5 / 80 / 720000`.

**Step 3: Implement the minimal default change**

In `defaultSyncBudgets`, return:

```ts
return {
  maxItems: 250,
  maxNewEpisodeDramas: 10,
  maxEpisodesPerDrama: 200,
  timeBudgetMs: 300_000,
};
```

Do not change short-form defaults.

**Step 4: Run tests**

```bash
cd apps/api
pnpm exec vitest run test/sync-budget.test.ts test/sync-fetch-all.test.ts
pnpm exec tsc --noEmit
```

Expected: both test files PASS and typecheck exits 0.

**Step 5: Commit**

```bash
git add apps/api/src/sync/budget.ts apps/api/test/sync-budget.test.ts
git commit -m "perf(sync): bound longform maintenance to five minutes"
```

### Task 2: Extract a finite bootstrap continuation policy

**Files:**
- Create: `apps/api/src/sync/bootstrap.ts`
- Create: `apps/api/test/sync-bootstrap.test.ts`

**Step 1: Write failing policy tests**

Create tests for pure helpers:

```ts
import { describe, expect, it } from "vitest";
import {
  BOOTSTRAP_PROVIDERS,
  parseBootstrapArgs,
  shouldContinueBootstrap,
} from "../src/sync/bootstrap";

describe("parseBootstrapArgs", () => {
  it("defaults to both longform providers and a finite pass limit", () => {
    expect(parseBootstrapArgs([])).toEqual({
      providers: ["wetv", "moviebox"],
      maxPasses: 20,
      delayMs: 3000,
    });
  });

  it("accepts a provider and bounded pass override", () => {
    expect(parseBootstrapArgs(["wetv", "--passes", "3", "--delay-ms", "0"]))
      .toEqual({ providers: ["wetv"], maxPasses: 3, delayMs: 0 });
  });

  it("rejects providers outside the allowlist", () => {
    expect(() => parseBootstrapArgs(["shortmax"]))
      .toThrow("bootstrap only supports wetv and moviebox");
  });
});

describe("shouldContinueBootstrap", () => {
  it("continues only when progress was made and passes remain", () => {
    expect(shouldContinueBootstrap({ episodeNew: 10, pass: 1, maxPasses: 3 })).toBe(true);
    expect(shouldContinueBootstrap({ episodeNew: 0, pass: 1, maxPasses: 3 })).toBe(false);
    expect(shouldContinueBootstrap({ episodeNew: 10, pass: 3, maxPasses: 3 })).toBe(false);
  });
});
```

**Step 2: Run to verify failure**

```bash
cd apps/api
pnpm exec vitest run test/sync-bootstrap.test.ts
```

Expected: FAIL because `src/sync/bootstrap.ts` does not exist.

**Step 3: Implement pure helpers**

Create `apps/api/src/sync/bootstrap.ts` with:

```ts
export const BOOTSTRAP_PROVIDERS = ["wetv", "moviebox"] as const;

export function parseBootstrapArgs(args: string[]) {
  const passIndex = args.indexOf("--passes");
  const delayIndex = args.indexOf("--delay-ms");
  const providers = args.filter((arg, index) =>
    !arg.startsWith("--") &&
    index !== passIndex + 1 &&
    index !== delayIndex + 1
  );
  const selected = providers.length ? providers : [...BOOTSTRAP_PROVIDERS];
  if (selected.some((code) => !BOOTSTRAP_PROVIDERS.includes(code as never))) {
    throw new Error("bootstrap only supports wetv and moviebox");
  }
  const positive = (value: string | undefined, fallback: number, allowZero = false) => {
    const n = Number(value);
    return Number.isInteger(n) && (allowZero ? n >= 0 : n > 0) ? n : fallback;
  };
  return {
    providers: selected,
    maxPasses: positive(args[passIndex + 1], 20),
    delayMs: positive(args[delayIndex + 1], 3000, true),
  };
}

export function shouldContinueBootstrap(input: {
  episodeNew: number;
  pass: number;
  maxPasses: number;
}) {
  return input.episodeNew > 0 && input.pass < input.maxPasses;
}
```

Adjust TypeScript narrowing minimally if required; do not add a CLI library.

**Step 4: Run tests and typecheck**

```bash
cd apps/api
pnpm exec vitest run test/sync-bootstrap.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS and exit 0.

**Step 5: Commit**

```bash
git add apps/api/src/sync/bootstrap.ts apps/api/test/sync-bootstrap.test.ts
git commit -m "feat(sync): add finite longform bootstrap policy"
```

### Task 3: Add the executable local bootstrap loop

**Files:**
- Create: `apps/api/scripts/bootstrap-longform.ts`
- Modify: `apps/api/package.json`

**Step 1: Add a failing package-script assertion**

Extend `apps/api/test/sync-bootstrap.test.ts` to read `apps/api/package.json` and assert:

```ts
expect(pkg.scripts["sync:longform:bootstrap"])
  .toBe("node --import tsx scripts/bootstrap-longform.ts");
```

Use `readFileSync(new URL("../package.json", import.meta.url), "utf8")`; no dependency.

**Step 2: Run to verify failure**

```bash
cd apps/api
pnpm exec vitest run test/sync-bootstrap.test.ts
```

Expected: FAIL because the script key is absent.

**Step 3: Implement the bootstrap runner**

Create `apps/api/scripts/bootstrap-longform.ts` that:

- validates `DATABASE_URL` and `PROVIDER_BASE_URL` without printing values;
- parses args with `parseBootstrapArgs`;
- calls `syncProvider` serially for each selected provider;
- passes:

```ts
{
  fast: true,
  maxItems: 250,
  maxNewEpisodeDramas: 20,
  maxEpisodesPerDrama: 500,
  timeBudgetMs: 300_000,
  env: process.env as Record<string, string | undefined>,
}
```

- accumulates `dramaNew`, `dramaUpdated`, `episodeNew`, and `errorCount`;
- prints one concise line per pass;
- sleeps with native `setTimeout` only between passes;
- stops when `shouldContinueBootstrap` returns false;
- prints `no episode progress; remaining empty/incomplete titles require upstream data` when a pass inserts zero episodes;
- exits non-zero for a thrown provider-level failure.

Add to `apps/api/package.json`:

```json
"sync:longform:bootstrap": "node --import tsx scripts/bootstrap-longform.ts"
```

Do not add dependencies.

**Step 4: Run verification**

```bash
cd apps/api
pnpm exec vitest run test/sync-bootstrap.test.ts test/sync-budget.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS and exit 0.

**Step 5: Commit**

```bash
git add apps/api/scripts/bootstrap-longform.ts apps/api/package.json apps/api/src/sync/bootstrap.ts apps/api/test/sync-bootstrap.test.ts
git commit -m "feat(sync): add resumable longform bootstrap runner"
```

### Task 4: Apply the five-minute workflow budget

**Files:**
- Modify: `.github/workflows/daily-sync.yml`

**Step 1: Update the explicit workflow value**

Change:

```yaml
SYNC_TIME_BUDGET_MS: "720000"
```

to:

```yaml
SYNC_TIME_BUDGET_MS: "300000"
```

Update the adjacent comment to document long-form defaults `250/10/200`; do not duplicate all provider-specific env values.

**Step 2: Verify workflow text and API tests**

```bash
rg -n 'SYNC_TIME_BUDGET_MS|longform' .github/workflows/daily-sync.yml
cd apps/api
pnpm exec vitest run test/sync-budget.test.ts test/sync-bootstrap.test.ts
```

Expected: output contains `SYNC_TIME_BUDGET_MS: "300000"`; tests PASS.

**Step 3: Commit**

```bash
git add .github/workflows/daily-sync.yml
git commit -m "ci(sync): cap daily provider work at five minutes"
```

### Task 5: Run a guarded production bootstrap

**Files:**
- No source changes expected.

**Step 1: Record pre-run counts without exposing credentials**

Use the existing deployment env and a read-only count query or existing catalog API. Record title and episode counts for WeTV/MovieBox.

Expected baseline near:

```text
wetv: 180 titles / 7675 episodes
moviebox: 191 titles / 4611 episodes
```

**Step 2: Run one guarded pass**

From `apps/api`, load the existing deploy environment without printing it, then run:

```bash
pnpm sync:longform:bootstrap -- --passes 1
```

Expected: both providers finish; no process exceeds the five-minute soft budget.

**Step 3: Inspect the result before allowing more passes**

- If `episodeNew > 0`, run the default bootstrap.
- If `episodeNew == 0`, stop: current upstream-returned catalog is already full.
- If provider-level errors occur, do not retry unchanged more than once; diagnose the upstream response.

**Step 4: Run full bootstrap only if useful**

```bash
pnpm sync:longform:bootstrap
```

Expected: finite termination on a no-progress pass or pass 20.

**Step 5: Record post-run counts and empty titles**

Confirm:

- title counts did not decrease;
- episode counts only increased or stayed equal;
- no duplicate episode keys exist;
- the only unresolved titles are those whose upstream `fetchEpisodes` returns empty/error.

### Task 6: Full verification and documentation

**Files:**
- Modify only if evidence changed: `docs/launch-readiness.md`

**Step 1: Run focused and full API verification**

```bash
cd apps/api
pnpm exec vitest run test/sync-budget.test.ts test/sync-bootstrap.test.ts test/sync-fetch-all.test.ts test/wetv-provider.test.ts test/moviebox-provider.test.ts
pnpm exec tsc --noEmit
```

Expected: all focused tests PASS and typecheck exits 0.

**Step 2: Review the diff**

```bash
git diff --check
git status --short
git diff -- apps/api/src/sync/budget.ts apps/api/src/sync/bootstrap.ts apps/api/scripts/bootstrap-longform.ts apps/api/package.json apps/api/test/sync-budget.test.ts apps/api/test/sync-bootstrap.test.ts .github/workflows/daily-sync.yml
```

Expected: no whitespace errors, no secrets, no unrelated files.

**Step 3: Commit evidence only if documentation was updated**

```bash
git add docs/launch-readiness.md
git commit -m "docs: record longform bootstrap verification"
```

**Step 4: Push after all checks pass**

```bash
git push origin main
```

Expected: push exits 0.
