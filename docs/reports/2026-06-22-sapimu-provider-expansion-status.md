# Sapimu Provider Expansion — Status Report

**Date:** 2026-06-22
**Commits:** `fc40a94` → `eb9783c`
**Deployed:** `api.dramaplay.my.id` (Worker `2e06261d`)

## Outcome

**6 of 8 Sapimu providers pass the full quality gate** (title + poster + episodes > 0
+ episode 1 playable) and are **live in production** with end-to-end watch verified.

### Live providers (enabled)

| Provider      | Dramas | Episodes | Watch stream source (verified live)          | Status |
|---------------|--------|----------|----------------------------------------------|--------|
| shortmax      | 20     | 1478     | (pre-existing)                               | ✅ live |
| dramawave     | 33     | 517      | `video-v6.mydramawave.com` (m3u8)            | ✅ live |
| netshort      | 25     | 1234     | `txvideo.netshort.com`                       | ✅ live |
| melolo        | 18     | 1482     | `tobrutmelolo.inicdn.net`                    | ✅ live |
| dramaboxbaru  | 20     | 1529     | proxy → raw m3u8 (`hwzthls.dramaboxdb.com`)  | ✅ live |
| pinedrama     | 20     | 999      | `tiktokcdn.com` (mp4)                        | ✅ live |

**Totals: 136 dramas, 6239 episodes across 6 enabled providers.**

Catalog (`/catalog/trending`, `/catalog/new`, `/catalog/search`), detail
(`/catalog/dramas/:slug`), and watch (`/watch/:slug/:n`) all return provider
badges and real stream URLs.

### Blocked providers (seeded disabled)

| Provider    | Failure                  | Root cause                                  | Fix path |
|-------------|--------------------------|---------------------------------------------|----------|
| reelshort   | episode 1 not playable   | Chapter 1 is VIP-locked (`locked:true`)      | Needs entitlement/token scope or free-episode mapping |
| dramanova   | HTTP 500 on `/api/video` | Video endpoint auth-gated (Chinese auth err) | Token may lack dramanova scope; episodes have `fileId` but `/video?fileId=` rejects |

These 2 are **upstream auth/scope issues**, not code bugs. Adapters + endpoint
paths are in place (`batch1.ts`); re-run smoke to recheck:

```bash
SAPIMU_TOKEN=$PROVIDER_API_TOKEN SAPIMU_BASE_URL=$PROVIDER_BASE_URL \
  pnpm --filter @dramaplay/api smoke:providers
```

## Provider-specific notes

- **dramaboxbaru**: uses `lang=in` (Bahasa Indonesia), NOT `id` (`lang=id` → 500).
  Feed via `/api/search` with Indonesian keywords (`cinta`/`raja`/`a` — English
  keywords return 0). `/api/stream` returns a raw m3u8 manifest behind auth →
  served via the `/proxy/sapimu-stream` Worker route (manifest is small; its
  `.ts` segments are public CDN and play directly).
- **pinedrama**: detail/play use `collection_id` + `language=id` + `region=ID`
  (NOT `dramaId`/`lang`). Play returns `data.playUrl` (tiktokcdn mp4) — public.
- **melolo**: drama metadata at `cell.cell_data[*].books` (feed) and `data.series`
  (detail, `series_id`/`intro`). Play via `/multi-video?id=` returns `stream_url`.

## Architecture

- `providers/sapimu/base.ts` — `SapimuBaseAdapter` + `createSapimuAdapter()`
  config-driven factory. Common-name field fallbacks (learned from live probing)
  handle all observed response shapes. `firstArray` unwraps module-wrapped arrays
  (items/dramas/books/lists/cell_data/bookList); `findDetailRow`/`findEpisodeList`
  walk nested objects; `findStreamUrl` skips image URLs, prioritizes stream keys.
  `rawStream` flag → resolver returns a proxy URL (no HTTP) for raw-manifest providers.
- `providers/sapimu/batch1.ts` — 7 provider configs (endpoint paths + flags).
- `providers/registry.ts` — registers shortmax (legacy) + batch1 factory adapters.
- `routes/watch.ts` — selects adapter by the drama's providerCode (was hardcoded
  to first adapter — broke watch for non-shortmax dramas).
- `sync/sync.ts` — bulk per-drama episode insert (2 queries/drama).
- `index.ts` — `/proxy/sapimu-stream` route: auth-injected manifest proxy + CORS.
- `scripts/smoke-sapimu-providers.ts` — quality-gate smoke test.
- `scripts/sync-providers.ts` — manual sync runner (cron disabled).

## Pending

- **Cron triggers** still commented in `wrangler.toml` (blocked on Cloudflare
  workers.dev subdomain creation). `scheduled()` handler deployed + ready.
  Until enabled, run `scripts/sync-providers.ts` manually to refresh catalogs.
- **reelshort / dramanova**: blocked upstream — revisit when Sapimu auth/scope
  or free-episode access is clarified.
