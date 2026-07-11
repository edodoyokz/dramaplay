# Task 4 Result: Runtime Validation at Trust Boundaries

## Implemented

Created `apps/api/src/lib/validation.ts` with three tiny runtime validators:
- `stringField`
- `numberField`
- `enumField`

Applied validation at trust boundaries:
- `apps/api/src/routes/billing.ts` `/checkout` — validates `planCode` is a non-empty string
- `apps/api/src/routes/pakasir.ts` `/webhook` — validates `amount` is a finite number ≥1, `order_id` and `project` are non-empty strings
- `apps/api/src/routes/admin.ts` `/dramas/:id/access` — validates `accessType` is `"free"` or `"vip"`

Added `apps/api/test/validation.test.ts` with 4 tests covering invalid inputs.

## Tests

- `pnpm --filter @dramaplay/api exec vitest run test/validation.test.ts` → 4/4 PASS
- `pnpm --filter @dramaplay/api run test` → 9 files, 53 tests PASS
- `pnpm -r run typecheck` → PASS
- `pnpm -r run lint` → PASS

## Changed Files

- `apps/api/src/lib/validation.ts` (new)
- `apps/api/test/validation.test.ts` (new)
- `apps/api/src/routes/billing.ts`
- `apps/api/src/routes/pakasir.ts`
- `apps/api/src/routes/admin.ts`

## Self-Review

- Minimal scope: only trust boundaries touched, no new dependencies.
- TDD followed: test written first, failed, then routes fixed.
- No leftover lint/type errors across workspace.

## Residual Risks

- Other routes still rely on `c.req.json<T>()` assertions; only specified trust boundaries now validate.
- Test mocks follow the existing coarse `@dramaplay/db` mock pattern, so they don't exercise real Drizzle behavior.
