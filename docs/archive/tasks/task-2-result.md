# Task 2 Result: Make Pakasir Webhook Atomic

## What was implemented

Modified `apps/api/src/routes/pakasir.ts` so the payment update is conditional on `status = 'pending'`. If another webhook already processed the payment, the conditional update returns no rows and the handler returns `{ ok: true }` without inserting a second subscription.

Also updated the subscription creation to use the returned `paidPayment.userId` and `paidPayment.planId` (fresh row from the update).

Added `apps/api/test/pakasir-webhook.test.ts` with three tests:
1. Already-paid payment returns early and skips subscription insert.
2. Conditional update returning no row skips subscription insert.
3. Successful verified payment creates exactly one subscription.

## What was tested

- `pnpm --filter @dramaplay/api exec vitest run test/pakasir-webhook.test.ts` → PASS (3 tests)
- `pnpm --filter @dramaplay/api run test` → PASS (7 files, 47 tests)
- `pnpm --filter @dramaplay/api run typecheck` → PASS

## Files changed

- `apps/api/src/routes/pakasir.ts`
- `apps/api/test/pakasir-webhook.test.ts`

## Self-review findings

- The mock chain was initially returning the wrong row through `from()`, causing `invalid_amount`. Fixed by having `makeDb.select()` return the payment row directly.
- Removed a debug `console.log` before committing.
- No scope widening.

## Issues or concerns

- None.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Only touched apps/api/src/routes/pakasir.ts and added apps/api/test/pakasir-webhook.test.ts; no unrelated changes"
    }
  ],
  "changedFiles": [
    "apps/api/src/routes/pakasir.ts",
    "apps/api/test/pakasir-webhook.test.ts"
  ],
  "testsAddedOrUpdated": [
    "apps/api/test/pakasir-webhook.test.ts"
  ],
  "commandsRun": [
    {
      "command": "pnpm --filter @dramaplay/api exec vitest run test/pakasir-webhook.test.ts",
      "result": "passed",
      "summary": "3/3 tests passed"
    },
    {
      "command": "pnpm --filter @dramaplay/api run test",
      "result": "passed",
      "summary": "7 test files, 47 tests passed"
    },
    {
      "command": "pnpm --filter @dramaplay/api run typecheck",
      "result": "passed",
      "summary": "tsc --noEmit succeeded"
    }
  ],
  "validationOutput": [],
  "residualRisks": [
    "DB-level unique constraint on (user_id, active subscription) would provide additional defense against any future non-webhook subscription creation paths"
  ],
  "noStagedFiles": true,
  "notes": "Committed as 2a6d981"
}
```
