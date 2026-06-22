# ShortMax Playback Slice Design

## Goal
Ship the smallest reliable content-and-streaming slice: ShortMax via Sapimu syncs dramas and episodes, users can open a drama, choose any episode, play it, and move to the next episode.

## Scope
- Provider: Sapimu ShortMax only.
- Access: all episodes free for now.
- Sync size: latest 20–100 dramas.
- Playback: lazy stream resolution when user opens an episode.

## Data & Sync
Sync fetches:

```txt
GET https://captain.sapimu.au/shortmax/api/v1/feed/new?lang=id
Authorization: Bearer <token>
```

For each drama, upsert:
- title
- synopsis
- poster
- episode count

For episodes, create synthetic episode rows from the provider episode count. Provider mapping uses:

```txt
drama_providers.provider_drama_id = <shortmax code>
episode_providers.provider_episode_id = <shortmax code>:<episode number>
```

Do not prefetch stream URLs. They can expire and bulk resolving wastes provider quota.

## Watch API & Playback
When the frontend calls:

```txt
GET /watch/:slug/:episodeNumber
```

The API loads:
- drama by slug
- episode by drama ID and episode number
- primary provider episode mapping

The Sapimu adapter parses `providerEpisodeId` like `853983:12` and resolves:

```txt
GET https://captain.sapimu.au/shortmax/api/v1/play/853983?ep=12&lang=id
Authorization: Bearer <token>
```

The API returns a stream source and next episode metadata. Frontend displays video, episode selection, and next episode navigation.

## Error Handling
Sync failures must not delete working data. On provider failure:
- mark sync as failed
- keep existing catalog
- log error details

Per-drama sync failures skip only that drama.

Playback failures return:

```json
{ "error": "stream_unavailable" }
```

with HTTP 502. Frontend shows a small retry state.

## Testing
Minimum verification:

```bash
pnpm typecheck
pnpm --filter @dramaplay/consumer build
```

Production smoke:

```txt
/catalog/new
/catalog/dramas/:slug
/watch/:slug/1
```

Manual browser check:
- home has ShortMax dramas
- drama page has episodes
- any episode can be opened
- next episode works

## Deferred
- VIP gating
- multi-provider support
- stream URL cache
- subtitles/quality selector
- full Playwright E2E
