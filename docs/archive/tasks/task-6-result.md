# Task 6 Result: Prevent stale VIP cache bypass

## Implemented

Modified `apps/api/src/routes/watch.ts` so the watch cache is only consulted for **free** episodes:

- Moved cache lookup to **after** the drama and episode are loaded from the DB.
- Only check/return cached response when `episode.accessType === "free"`.
- VIP episodes still re-verify entitlement on every request and are never cached.
- Removed the pointless single-element `Promise.all` around `getPrimaryProvider()`.

Modified `apps/api/test/watch.test.ts`:

- Added regression test: free episode cached, then DB returns VIP for the same episode, unauthenticated request returns `403` instead of stale `200`.
- Updated the existing cache-hit test to call `reset()` between requests because cache is now checked after the DB lookup still happens.

## Commands Run

```bash
pnpm --filter @dramaplay/api exec vitest run test/watch.test.ts
# Result: 5/5 pass

pnpm --filter @dramaplay/api run test
# Result: 10 test files, 56 tests pass

pnpm --filter @dramaplay/api run typecheck
# Result: pass
```

## Validation

- New regression test fails before the fix (returns 200 from stale cache) and passes after the fix (returns 403).
- Existing cache-hit test still passes.
- Full API test suite still passes.
- TypeScript typecheck passes.

## Changed Files

- `apps/api/src/routes/watch.ts`
- `apps/api/test/watch.test.ts`

## Residual Risks

- In-isolate cache remains limited across Cloudflare Workers isolates; this task only fixed the access-type staleness issue.
- Cache TTL is still 60s for free episodes, which is acceptable for free content.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "watch.ts cache lookup moved after DB lookup and gated to free episodes only; Promise.all simplified; tests updated and passing"
    }
  ],
  "changedFiles": [
    "apps/api/src/routes/watch.ts",
    "apps/api/test/watch.test.ts"
  ],
  "testsAddedOrUpdated": [
    "apps/api/test/watch.test.ts: added 'free episode cache is invalidated when access type changes to VIP'",
    "apps/api/test/watch.test.ts: updated 'serves free episode, second request hits cache' to reset state between requests"
  ],
  "commandsRun": [
    {
      "command": "pnpm --filter @dramaplay/api exec vitest run test/watch.test.ts",
      "result": "passed",
      "summary": "5/5 watch tests pass"
    },
    {
      "command": "pnpm --filter @dramaplay/api run test",
      "result": "passed",
      "summary": "10 test files, 56 tests pass"
    },
    {
      "command": "pnpm --filter @dramaplay/api run typecheck",
      "result": "passed",
      "summary": "tsc --noEmit exits cleanly"
    }
  ],
  "validationOutput": [
    "New regression test red→green verified: stale cache returned 200 before fix, 403 after fix",
    "Existing watch cache behavior preserved for free episodes"
  ],
  "residualRisks": [
    "In-isolate cache still not shared across Workers isolates",
    "Free-episode cache TTL remains 60s"
  ],
  "noStagedFiles": true,
  "notes": "Committed as 3dd0297. No uncommitted staged files remain."
}
```
