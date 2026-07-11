# Task 3 Result: Reuse database connection during provider sync

## What was implemented

- Modified `apps/api/src/sync/sync.ts`:
  - `syncProvider` now accepts `dbOrUrl: string | Database`.
  - If a `Database` instance is passed, it is reused directly.
  - If a URL string is passed, `createDb` is called for backward compatibility.
  - Imported `type Database` from `@dramaplay/db`.

- Modified `apps/api/src/index.ts`:
  - The scheduled handler now passes the existing `db` instance into `syncProvider` instead of `env.DATABASE_URL`.

- Created `apps/api/test/sync-db-reuse.test.ts`:
  - Verifies `syncProvider` does not call `createDb` when given a `Database` instance.
  - Verifies `syncProvider` still calls `createDb` when given a URL string.

- `apps/api/src/routes/admin.ts` was intentionally left unchanged; it still passes `c.env.DATABASE_URL` (string) for manual sync.

## Test results

- Focused test `test/sync-db-reuse.test.ts`: ✅ 2/2 passed.
- Full API test suite: ✅ 49/49 passed (8 test files).
- API typecheck: ✅ passed.

## Commands run

```bash
pnpm --filter @dramaplay/api exec vitest run test/sync-db-reuse.test.ts  # ✅
pnpm --filter @dramaplay/api run test                                     # ✅
pnpm --filter @dramaplay/api run typecheck                                # ✅
```

## Self-review findings

- Scope was kept minimal; no unrelated changes.
- Backward compatibility preserved (string URL still works).
- The fake DB mock is minimal but sufficient to exercise the `dbOrUrl` dispatch path.
- One residual risk: the test mock does not deeply verify that every query path uses the passed DB instance, only that `createDb` is not invoked when a DB instance is supplied.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "syncProvider accepts string | Database, index.ts passes existing db instance, admin.ts keeps URL-based path, and tests verify both code paths."
    }
  ],
  "changedFiles": [
    "apps/api/src/sync/sync.ts",
    "apps/api/src/index.ts",
    "apps/api/test/sync-db-reuse.test.ts"
  ],
  "testsAddedOrUpdated": [
    "apps/api/test/sync-db-reuse.test.ts"
  ],
  "commandsRun": [
    {
      "command": "pnpm --filter @dramaplay/api exec vitest run test/sync-db-reuse.test.ts",
      "result": "passed",
      "summary": "2/2 tests passed after implementing the fix"
    },
    {
      "command": "pnpm --filter @dramaplay/api run test",
      "result": "passed",
      "summary": "49/49 tests passed across 8 test files"
    },
    {
      "command": "pnpm --filter @dramaplay/api run typecheck",
      "result": "passed",
      "summary": "tsc --noEmit completed without errors"
    }
  ],
  "validationOutput": [],
  "residualRisks": [
    "Test mock only verifies createDb call count, not that every internal query uses the supplied DB instance."
  ],
  "noStagedFiles": true,
  "notes": "Task completed with minimal scope. admin.ts was not modified because the string-based path remains supported."
}
```
