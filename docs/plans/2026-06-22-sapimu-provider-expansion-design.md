# Sapimu Provider Expansion Design

**Goal:** Add a first batch of Sapimu-backed short-drama providers while keeping user UX reliable and metadata complete enough for browsing and playback.

**Status:** Approved in brainstorming
**Date:** 2026-06-22

---

## Decisions

### Provider model

Provider means **source catalog**, not fallback server.

Do not treat the same/similar title across providers as interchangeable. A ReelShort title and a NetShort title may have different story, episode count, cuts, or source IDs.

User-facing behavior:

- No cross-provider fallback.
- No auto-merge across providers.
- Similar titles from different providers remain separate catalog items.
- Provider badge is visible in catalog, detail, and watch.

Admin/debug behavior later:

- Possible duplicate detection can exist later as admin-only metadata.
- It must not merge user-facing content automatically in v1.

### Batch 1 providers

Seed and support these Sapimu provider codes:

1. `dramaboxbaru` — maps to DramaBox
2. `dramawave`
3. `pinedrama`
4. `reelshort`
5. `netshort`
6. `dramanova`
7. `melolo`

Also keep existing `shortmax`.

Seed new providers as `isEnabled=false` by default. Enable only after smoke/quality checks pass.

### Architecture

Use a hybrid adapter approach:

- Shared Sapimu helper/base:
  - auth header
  - `getJson()`
  - response traversal
  - `findStreamUrl()`
  - stream type detection
  - common list flattening helpers

- Provider-specific small adapters/mappers:
  - `SapimuDramaboxAdapter`
  - `SapimuDramaWaveAdapter`
  - `SapimuPineDramaAdapter`
  - `SapimuReelShortAdapter`
  - `SapimuNetShortAdapter`
  - `SapimuDramaNovaAdapter`
  - `SapimuMeloloAdapter`

Avoid one generic mega-adapter. Endpoint shapes differ too much.

### Quality gate

A drama may become public only if it has:

- valid title
- valid poster URL
- episode count greater than zero
- episode list or generated episode list
- episode 1 resolves to a playable stream URL
- provider/source metadata

If quality gate fails:

- keep it hidden or skip it in v1
- record failure reason in provider metadata/logs where cheap
- do not show it to users

### Slugs and duplicates

Slug must include provider code to avoid overwrites:

```txt
{providerCode}-{slugifiedTitle}
```

Example:

```txt
reelshort-love-in-the-ashes
netshort-love-in-the-ashes
```

Same/similar title from different providers remains separate.

### Metadata target

Enriched UX metadata:

- `title`
- `posterUrl`
- `episodeCount`
- `synopsis` where available
- `genres` / `tags` where available
- `language` / `country` where available
- provider badge/source info

Store only small raw/source metadata in `drama_providers.metadata`; do not store full provider responses in DB.

Example:

```json
{
  "sourceTitle": "...",
  "sourcePoster": "...",
  "qualityGate": {
    "status": "passed",
    "checkedAt": "2026-06-22T00:00:00.000Z",
    "episode1Playable": true
  }
}
```

### API / UX shape

Catalog item should include provider badge:

```json
{
  "slug": "reelshort-love-in-ashes",
  "title": "Love in the Ashes",
  "posterUrl": "...",
  "episodeCount": 60,
  "provider": {
    "code": "reelshort",
    "name": "ReelShort"
  }
}
```

Detail response includes provider:

```json
{
  "drama": {
    "title": "...",
    "synopsis": "...",
    "tags": ["Billionaire", "Romance"],
    "provider": {
      "code": "reelshort",
      "name": "ReelShort"
    }
  },
  "episodes": []
}
```

Watch response includes provider:

```json
{
  "streamUrl": "...",
  "streamType": "m3u8",
  "provider": {
    "code": "reelshort",
    "name": "ReelShort"
  }
}
```

Stream failure UX:

- retry same provider once
- try alternate quality URL from same provider response if available
- if still failed, show provider-specific error:

```txt
Stream dari ReelShort sedang bermasalah. Coba lagi nanti.
```

Do not show “server lain” across providers.

### Sync rollout

- Seed providers as disabled.
- Run smoke check per provider.
- Enable provider one-by-one after it passes.
- Use small sync limits first:
  - 20 items/provider/run
  - episode 1 quality gate only
- Do not resolve every episode during sync.
- Resolve actual playback URL at watch time because stream URLs can expire.

### Testing

Adapter tests:

- mapping summary responses
- mapping detail responses
- mapping episode list or generated episode list
- stream URL extraction

Sync tests:

- provider-prefixed slug
- same title across providers does not overwrite
- failed quality gate hides/skips item

API tests:

- catalog includes provider badge
- detail includes provider badge
- watch includes provider badge

Live smoke script:

- uses `.env.deploy`
- for each enabled/provider candidate:
  - fetch list
  - fetch detail first item
  - fetch/generate episodes
  - resolve episode 1
  - output matrix: list/detail/episodes/play status

---

## Open implementation note

Existing `syncProvider()` currently assumes one title slug globally. Implementation must change this before enabling multi-provider sync.

Existing `buildProviders()` currently returns only `shortmax` for Sapimu. Implementation must expand registry after adapters exist.
