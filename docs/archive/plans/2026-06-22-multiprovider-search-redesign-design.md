# Multiprovider Search Redesign Design

## Goal

Make search useful for many providers without increasing server load.

## Current issues

- Results are mixed across all providers, but the UI does not show provider badges.
- Users cannot filter search by provider.
- Backend search has no cache and no pagination.
- Every typed query hits the DB after a 150ms debounce.
- Query length is not constrained, so 1-character searches can trigger broad scans.

## Design

### UX

Search page shows:

1. Sticky search input.
2. Provider filter chips:
   - `Semua`
   - one chip per enabled provider from `/catalog/home`
3. Results grid with provider badge on each drama card.
4. `Muat Lagi` button for pagination.

URL state:

```text
/search?q=cinta&provider=reelshort&page=1
```

Rules:

- If query length is 0: show popular suggestions.
- If query length is 1: show "Minimal 2 karakter" and do not call backend.
- If provider selected: backend filters by that provider.
- Results show provider badge even when provider filter is active.

### API

Extend existing endpoint:

```text
GET /catalog/search?q=&provider=&page=&limit=
```

Response:

```json
{
  "items": [],
  "page": 1,
  "limit": 24,
  "hasMore": false,
  "provider": { "code": "reelshort", "name": "ReelShort" }
}
```

`provider` is omitted when searching all providers.

### Server-load controls

- Minimum query length: 2 characters.
- Limit capped at 50.
- Pagination via `limit + 1`.
- Cache search responses with existing in-isolate catalog cache.
- Single SQL query per search; no fan-out to provider APIs.
- Filter by local DB provider rows only.

### Deferred

- PostgreSQL trigram index for `title`.
- Full-text ranking.
- Search suggestions from analytics.
- Multi-provider multi-select.

Add only when usage data proves needed.
