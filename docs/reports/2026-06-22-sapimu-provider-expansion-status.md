# Sapimu Provider Expansion — Status Report

**Date:** 2026-06-22
**Commits:** `fc40a94` → `031083b`
**Deployed:** `api.dramaplay.my.id` (Worker `8c563b9a`)

## Outcome

4 of 8 Sapimu providers pass the full quality gate (title + poster + episodes > 0
+ episode 1 playable) and are **live in production** with end-to-end watch verified.

### Live providers (enabled)

| Provider  | Dramas | Episodes | Watch stream source (verified)      | Status |
|-----------|--------|----------|--------------------------------------|--------|
| shortmax  | 20     | 1478     | (pre-existing)                       | ✅ live |
| dramawave | 33     | 517      | `video-v6.mydramawave.com` (m3u8)    | ✅ live |
| netshort  | 25     | 1234     | `txvideo.netshort.com`               | ✅ live |
| melolo    | 18     | 1482     | `tobrutmelolo.inicdn.net`            | ✅ live |

Catalog (`/catalog/trending`, `/catalog/new`), detail (`/catalog/dramas/:slug`),
and watch (`/watch/:slug/:n`) all return provider badges and real stream URLs.

### Blocked providers (seeded disabled)

| Provider      | Failure                  | Root cause                                  | Fix path |
|---------------|--------------------------|---------------------------------------------|----------|
| dramaboxbaru  | HTTP 500                 | Upstream "connection cf eror server is down" | External — retry when Sapimu restores it |
| pinedrama     | HTTP 500                 | Upstream "connection cf eror server is down" | External — retry when Sapimu restores it |
| reelshort     | episode 1 not playable   | Chapter 1 is VIP-locked (`locked:true`)      | Needs entitlement/token scope or free-episode mapping |
| dramanova     | HTTP 400 on `/api/video` | Video endpoint auth-gated (Chinese auth err) | Token may lack dramanova scope; episodes have `fileId` but `/video?fileId=` rejects |

These 4 are **not code bugs** — they are upstream availability / auth-scope issues.
The adapters, endpoint paths, and field mappings are in place (`batch1.ts`); they
will pass once the upstream issues resolve. Re-run the smoke script to recheck:

```bash
SAPIMU_TOKEN=$PROVIDER_API_TOKEN SAPIMU_BASE_URL=$PROVIDER_BASE_URL \
  pnpm --filter @dramaplay/api smoke:providers
```

## Architecture

- `providers/sapimu/base.ts` — `SapimuBaseAdapter` + `createSapimuAdapter()` config-driven
  factory. Common-name field fallbacks (id/title/poster/synopsis/genres/episode-count)
  learned from live probing handle all observed response shapes generically.
  `firstArray` unwraps module-wrapped arrays (items/dramas/books/lists/cell_data);
  `findDetailRow`/`findEpisodeList` walk nested objects robustly; `findStreamUrl`
  skips image URLs and prioritizes stream keys.
- `providers/sapimu/batch1.ts` — 7 provider configs (endpoint paths only).
- `providers/registry.ts` — registers shortmax (legacy adapter) + batch1 factory adapters.
- `sync/sync.ts` — bulk per-drama episode insert (2 queries/drama, no unique constraint needed).
- `scripts/smoke-sapimu-providers.ts` — quality-gate smoke test.
- `scripts/sync-providers.ts` — manual sync runner (cron disabled).

## Pending

- **Cron triggers** still commented in `wrangler.toml` (blocked on Cloudflare
  workers.dev subdomain creation). The `scheduled()` handler (keep-alive +
  analytics purge + provider sync) is deployed and ready. Until crons are
  enabled, run `scripts/sync-providers.ts` manually to refresh catalogs.
- **dramawave episode coverage**: 517 episodes across 33 dramas (avg ~16) — many
  dramas have 0 episodes because dramawave detail exposes only `episode_count`
  (no episode array), and the fallback count-extraction misses some. Catalog
  browsing works; refine dramawave episode extraction if fuller lists are needed.
- **reelshort / dramanova**: blocked upstream — revisit when Sapimu auth/scope
  or free-episode access is clarified.
