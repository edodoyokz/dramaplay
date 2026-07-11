# Task 5 Result: Add minimal API rate limiting

Implemented in-isolate rate limiter and applied it to hot API routes.

## Files changed
- `apps/api/src/middleware/rate-limit.ts` (created)
- `apps/api/src/index.ts` (modified)
- `apps/api/test/rate-limit.test.ts` (created)

## Tests added
- `test/rate-limit.test.ts` — verifies limit enforcement and per-IP isolation.

## Commands run
- `pnpm --filter @dramaplay/api exec vitest run test/rate-limit.test.ts` → PASS (2 tests)
- `pnpm --filter @dramaplay/api run test` → PASS (10 files, 55 tests)
- `pnpm --filter @dramaplay/api run typecheck` → PASS

## Residual risks
- In-isolate only; global rate limiting still needs Cloudflare WAF/rules.
- Memory growth from module-level Map is bounded per isolate but unbounded across keys.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Created rate-limit middleware, applied to /catalog/search, /billing/checkout, /pakasir/webhook, /auth/*. No new dependencies. Tests and typecheck pass."
    }
  ],
  "changedFiles": [
    "apps/api/src/middleware/rate-limit.ts",
    "apps/api/src/index.ts",
    "apps/api/test/rate-limit.test.ts"
  ],
  "testsAddedOrUpdated": ["apps/api/test/rate-limit.test.ts"],
  "commandsRun": [
    {
      "command": "pnpm --filter @dramaplay/api exec vitest run test/rate-limit.test.ts",
      "result": "passed",
      "summary": "2 tests passed"
    },
    {
      "command": "pnpm --filter @dramaplay/api run test",
      "result": "passed",
      "summary": "10 test files, 55 tests passed"
    },
    {
      "command": "pnpm --filter @dramaplay/api run typecheck",
      "result": "passed",
      "summary": "No type errors"
    }
  ],
  "validationOutput": [],
  "residualRisks": [
    "In-isolate only; not shared across Workers isolates.",
    "Unbounded per-isolate Map growth with many distinct IPs/paths."
  ],
  "noStagedFiles": true,
  "notes": "Committed as a3ecac3."
}
```
