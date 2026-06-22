# Sapimu Provider Expansion — Final Status

**Date:** 2026-06-22
**Deployed:** `api.dramaplay.my.id` (Worker `8b7ea222`)

## Outcome: All 8 Sapimu providers LIVE ✅

Every provider passes the full quality gate (title + poster + episodes > 0 +
episode 1 playable) and is **live in production** with end-to-end watch verified.

### Live providers (all enabled)

| Provider      | Dramas | Episodes | Stream source (verified live)                |
|---------------|--------|----------|----------------------------------------------|
| shortmax      | 20     | 1478     | (pre-existing adapter)                       |
| dramawave     | 33     | 517      | `video-v6.mydramawave.com` (m3u8)            |
| netshort      | 25     | 1234     | `txvideo.netshort.com`                       |
| melolo        | 18     | 1482     | `tobrutmelolo.inicdn.net`                    |
| dramaboxbaru  | 20     | 1529     | proxy → raw m3u8 (`hwzthls.dramaboxdb.com`)  |
| pinedrama     | 20     | 999      | `tiktokcdn.com` (mp4)                        |
| dramanova     | 19     | 666      | `sulao.montagehub.xyz` (mp4)                 |
| reelshort     | 31     | 2150     | `v-mps.crazymaplestudios.com` (m3u8)         |

**Totals: 186 dramas, 10,055 episodes.**

Catalog (`/catalog/trending`, `/catalog/new`, `/catalog/search`), detail
(`/catalog/dramas/:slug`), and watch (`/watch/:slug/:n`) all return provider
badges and real stream URLs.

## Per-provider fixes (from live API probing)

- **dramaboxbaru**: `lang=in` (not `id`); feed via `/api/search` (Indonesian
  keywords); `/api/stream` returns raw m3u8 behind auth → `/proxy/sapimu-stream`
  route serves the manifest; segments are public CDN.
- **pinedrama**: detail/play use `collection_id` + `language=id` + `region=ID`;
  play returns `data.playUrl` (tiktokcdn mp4).
- **dramanova**: `lang=in` feed; episodes have `fileId`; play `/api/video?id=<fileId>`
  (param is `id`, not `fileId`) → `videos[].main_url` (mp4).
- **reelshort**: chapters at `/book/:id/chapters?lang=in` (separate from detail);
  play `/book/:id/chapter/:chapter_id/video` (chapter_id, not ep number) →
  `videos[].PlayURL` (m3u8).
- **melolo**: drama at `cell.cell_data[*].books` (feed) and `data.series`
  (detail, `series_id`/`intro`); play `/multi-video?id=` → `stream_url`.
- **netshort**: flat `data[]` feed; detail has `episodes[]` with episodeNo;
  play `/episode/:id/:episodeNo`.
- **dramawave**: module-wrapped `data.items[*].items` feed; detail at
  `data.info` (`episode_count`); play `/dramas/:id/play/:ep`.

## Architecture

- `providers/sapimu/base.ts` — `createSapimuAdapter()` config-driven factory:
  - Common-name field fallbacks (learned from live probing)
  - `firstArray`: generic module-unwrap (items/dramas/books/lists/cell_data/bookList)
  - `findDetailRow`/`findEpisodeList`: robust nested-object walkers
  - `findStreamUrl`: skips image URLs, prioritizes stream keys (main_url/PlayURL/stream_url)
  - `rawStream` flag: proxy URL for raw-manifest providers (dramaboxbaru)
  - `episodePlayField`: per-episode play param (fileId/chapter_id vs ep number)
  - `episodes` endpoint: separate chapter-list when split from detail
- `providers/sapimu/batch1.ts` — 7 provider configs (endpoint paths + flags)
- `providers/registry.ts` — registers shortmax (legacy) + batch1 factory adapters
- `routes/watch.ts` — selects adapter by drama's providerCode
- `routes/catalog.ts` — provider badges in catalog/detail responses
- `sync/sync.ts` — provider-prefixed slugs + bulk per-drama episode insert
- `index.ts` — `/proxy/sapimu-stream` (auth-injected manifest proxy + CORS) +
  `scheduled()` (keep-alive + analytics purge + provider sync, cron ready)
- `scripts/smoke-sapimu-providers.ts` — quality-gate smoke test (8/8 pass)
- `scripts/sync-providers.ts` — manual sync runner (cron disabled)

## Pending

- **Cron triggers** commented in `wrangler.toml` (blocked on Cloudflare
  workers.dev subdomain creation). `scheduled()` handler deployed + ready.
  Until enabled, run `scripts/sync-providers.ts` manually to refresh catalogs.
- **dramabox**: legacy JsonListProvider with 0 dramas — non-Sapimu, likely
  defunct. Consider disabling or removing.
