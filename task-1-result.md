# Task 1 Result: Fix Consumer Lint Errors

## What Changed

### `apps/consumer/src/pages/Home.tsx`
- Removed synchronous `setLoadingHome(true)` at the start of the mount effect.
- `loadingHome` already starts as `true` via `useState(true)`, so the explicit set was unnecessary and triggered `react-hooks/set-state-in-effect`.

### `apps/consumer/src/pages/ProviderDramas.tsx`
- Removed synchronous `setItems([])` and `setPage(1)` from the effect.
- Inlined the initial provider fetch inside the effect so state updates happen only in async callbacks.
- Kept the existing `load(nextPage)` helper for the "Muat Lagi" button (event handler, not an effect).

### `apps/consumer/src/pages/Search.tsx`
- Removed synchronous `setResults([])` and `setHasMore(false)` from the effect when the query is too short.
- The UI already renders a short-query message, so clearing state was unnecessary.

### `apps/consumer/src/App.tsx`
- Added a tiny `ProviderDramasRoute` wrapper that keys `ProviderDramas` by `location.pathname`.
- This preserves the loading-spinner behavior when navigating between provider pages, since the component now remounts.

## Verification

| Command | Result |
|---------|--------|
| `pnpm --filter @dramaplay/consumer run lint` | ✅ PASS, 0 errors, 0 warnings |
| `pnpm --filter @dramaplay/consumer run typecheck` | ✅ PASS |
| `pnpm --filter @dramaplay/consumer run build` | ✅ PASS |

## Commit

```
b05fe32 fix: resolve consumer set-state-in-effect lint errors
```

## Self-Review

- Diff is minimal and targeted.
- No new libraries or state managers introduced.
- `ProviderDramas` loading behavior preserved via route key.
- All three originally failing lint rules are now clean.

## Concern

`App.tsx` was not in the originally listed files, but a one-line route wrapper was the smallest way to keep the provider-page loading UX correct after removing state resets from the effect.
