# Provider Homepage Redesign Design

## Goal

Redesign the consumer homepage so users can browse by provider first, then open a full drama list only when they choose a provider.

## Problem

The current homepage fetches two mixed lists:

- `GET /catalog/trending`
- `GET /catalog/new`

This is okay with a few providers, but it does not scale well when Dramaplay has many providers. Users cannot easily choose a source they prefer, and the homepage risks becoming a random mix of dramas from whichever provider dominates ranking or sync time.

## Recommendation

Use a **provider-shelf homepage**.

Homepage shows enabled providers as sections. Each section contains:

- Provider name and badge/code
- Optional drama/episode counts
- 3 sample dramas from that provider
- CTA: **Lihat Semua**

When user taps **Lihat Semua**, fetch the full paginated list for that provider.

## Homepage UX

Recommended order:

1. Header + search button
2. Continue Watching, if local watch progress exists
3. Provider shelves:
   - Pinned/manual providers first using `providers.priority`
   - Remaining providers sorted by priority/popularity fallback
4. Optional mixed sections later, not v1

Example:

```text
Search

Lanjutkan Menonton

ReelShort
[Drama A] [Drama B] [Drama C]   Lihat Semua

DramaBoxBaru
[Drama A] [Drama B] [Drama C]   Lihat Semua

DramaNova
[Drama A] [Drama B] [Drama C]   Lihat Semua
```

## Backend API

Add two endpoints.

### `GET /catalog/home`

Returns provider shelves. Keep response small.

```json
{
  "providers": [
    {
      "code": "reelshort",
      "name": "ReelShort",
      "dramaCount": 31,
      "episodeCount": 2150,
      "items": [
        {
          "id": "...",
          "slug": "reelshort-adik-palsu-sang-adipati",
          "title": "Adik Palsu Sang Adipati",
          "posterUrl": "...",
          "episodeCount": 70,
          "rating": 0,
          "provider": { "code": "reelshort", "name": "ReelShort" }
        }
      ]
    }
  ]
}
```

Rules:

- Only `providers.isEnabled = true`
- Only public/published dramas
- Only primary provider rows
- Max 3 dramas per provider
- Cache 120 seconds, same as current catalog cache
- Sort providers by `providers.priority ASC`, then name
- Sort sample dramas by `popularityScore DESC`, then `createdAt DESC`

### `GET /catalog/providers/:code/dramas?page=1&limit=20`

Returns one provider's full drama list.

```json
{
  "provider": { "code": "reelshort", "name": "ReelShort" },
  "items": [ ... ],
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

Rules:

- `limit` capped at 50
- 404 if provider does not exist or is disabled
- Sort by `popularityScore DESC`, then `createdAt DESC`
- Cache key includes provider code/page/limit

## Frontend UX

### Homepage

Replace the mixed `Trending Sekarang` and `Drama Terbaru` sections with provider shelves.

Keep:

- Header
- VIP badge
- Search button
- Continue Watching

Remove for v1:

- Genre filter on homepage
- Big hero banner tied to first trending item

Reason: provider browsing is the new homepage purpose. Hero/genre can return later if usage data shows it helps.

### Provider list page

Add route:

```text
/provider/:code
```

This page shows:

- Sticky header with back button
- Provider name
- Grid of dramas
- Load more button or infinite scroll

Use **Load More** for v1. It is simpler and more predictable than infinite scroll.

## API Types

Extend consumer API types locally in `Home.tsx` or a small shared local type. Do not add a new shared package type unless reused elsewhere.

## Error Handling

Homepage:

- If `/catalog/home` fails, show a small retry state.
- If one provider has no dramas, backend should omit it from `providers`.

Provider page:

- 404/disabled provider: show "Provider tidak ditemukan".
- Empty provider: show "Belum ada drama dari provider ini".
- Load-more failure: keep existing items and show retry button.

## Performance

This design is free-tier friendly:

- Homepage returns ~8 providers × 3 items = 24 drama cards today.
- Even with 40 providers, response is ~120 items, still acceptable.
- Cache avoids repeated DB reads.
- Full drama lists are fetched only after user intent.

If provider count grows past ~50, add pagination to `/catalog/home` or only show top providers first.

## Tests

Backend tests:

- `/catalog/home` groups dramas by enabled provider and returns max 3 items per provider.
- Disabled providers are omitted.
- `/catalog/providers/:code/dramas` filters by provider and paginates.

Frontend checks:

- Homepage renders provider shelves from mocked API.
- Provider page renders first page and appends next page.

## Rollout

1. Add API endpoints behind existing catalog router.
2. Add tests.
3. Build homepage using `/catalog/home`.
4. Add provider page route.
5. Run typecheck/tests.
6. Deploy API and frontend.

## Skipped for v1

- Personalized provider ranking
- Genre filters per provider
- Infinite scroll
- Provider logos/artwork
- Admin UI for pinned providers beyond existing `providers.priority`

Add these only after real usage shows the need.
