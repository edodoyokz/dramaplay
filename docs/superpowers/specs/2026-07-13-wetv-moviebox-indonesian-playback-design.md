# WeTV and MovieBox Indonesian Playback Design

## Goal

Make WeTV and MovieBox titles reliably playable on Chrome desktop and Chrome Android, with Indonesian metadata and Indonesian subtitles when available. Original audio is allowed. If Indonesian subtitles are unavailable, playback continues without subtitles; another language must never be presented as Indonesian.

## Success criteria

1. Every WeTV and MovieBox metadata, search, detail, episode, and playback request uses the provider's Indonesian locale.
2. Only captions whose normalized language code or name identifies Indonesian are exposed as `subtitleLanguage: "id"`.
3. A title without Indonesian captions remains playable with no subtitle track.
4. MovieBox season and episode identity is preserved end to end, so episodes such as S1E1 and S2E1 cannot collide.
5. Existing MovieBox series can receive new seasons and episodes during scheduled sync.
6. WeTV HLS and MovieBox MP4 playback either reaches a playable browser state or presents a clear retry action after bounded recovery.
7. Subtitle proxy failures retain failure status instead of returning an empty or invalid HTTP 200 WebVTT response.
8. Automated tests cover provider mapping, sync, watch routing, proxy behavior, and player recovery. Browser smoke checks cover Chrome desktop and an Android-sized Chrome context.

## Scope

### Included

- WeTV and MovieBox locale and subtitle selection.
- MovieBox season-aware storage, sync, API responses, routing, and episode navigation.
- Long-form player media error handling.
- Existing stream/subtitle proxy correctness.
- Focused automated and browser playback checks.

### Excluded

- Indonesian dubbing or audio-track selection.
- English or other subtitle fallback.
- Quality selection, downloads, casting, recommendations, or MovieBox Shorts.
- Refactoring unrelated short-form playback.

## Data and provider design

The existing `WetvAdapter` and `MovieBoxAdapter` remain the provider boundary. No new provider abstraction or dependency is introduced.

All provider operations, including MovieBox search, send the upstream Indonesian locale. Subtitle language matching normalizes case and separators and recognizes only known Indonesian forms supplied by the providers, including `id`, `id-ID`, and MovieBox's `in_id`, plus an explicit Indonesian language name. Unknown, English, or first-item captions are not fallback candidates.

A resolved stream may omit `subtitleUrl` and `subtitleLanguage`. The watch response and consumer must preserve that absence rather than defaulting the language to `id`.

MovieBox season is stored separately from episode number. Provider episode IDs continue to retain the upstream subject/season/episode tuple. Episode uniqueness and sync comparisons use season plus episode, not episode number alone. API detail data exposes the season value, and consumer navigation uses a season-aware episode identity while retaining a single playable entry for movies.

Scheduled fast sync may skip unchanged metadata, but it must still discover and upsert newly published seasons and episodes for existing MovieBox series. It must not rewrite unrelated catalog records.

## Playback and proxy design

WeTV HLS continues through the allowlisted same-origin stream proxy and Hls.js where native HLS is unavailable. MovieBox HTTPS MP4 remains direct when it is a valid playable URL. Existing host and redirect allowlists remain mandatory.

The long-form player listens for native media errors and Hls.js fatal errors. It performs only the library-supported bounded network/media recovery. If recovery fails, it destroys the HLS instance, stops the loading state, and shows the existing retry action with a clear playback error. Retry requests a fresh watch response so expired provider URLs are not reused.

When an Indonesian subtitle exists, the player creates one default track labeled `Indonesia` with `srcLang="id"`. When it does not exist, no `<track>` is rendered. The UI does not claim that subtitles are available when they are absent.

The proxy converts successful MovieBox SRT responses to WebVTT and flattens successful WeTV VTT playlists. It checks the manifest and every required subtitle segment before returning success. Upstream HTTP errors, invalid subtitle bodies, or an unusable empty result return an error status; they are never converted into a successful empty track. Existing SSRF and redirect validation remains unchanged.

The long-form detail page groups series episodes by season and provides season-aware links. Previous/next navigation remains within the ordered season/episode sequence. Movies retain the existing single watch action.

## Error handling

- Malformed provider IDs, season values, episode values, and stream URLs are rejected at their existing trust boundaries.
- Missing Indonesian subtitles are a supported state, not a playback error.
- Missing or invalid video streams remain `stream_unavailable` responses.
- Subtitle loading failure does not stop video playback, but it must not be mislabeled as a valid Indonesian track.
- Fatal HLS/native media failure becomes a visible retry state rather than a permanently stalled player.
- Database migration and sync must preserve existing episodes; season backfill uses the season encoded in MovieBox provider IDs where available and the established default only where the provider has no season distinction.

## Testing and evidence

Focused fixture tests will verify:

1. WeTV accepts Indonesian language-code variants and rejects English/unknown fallback captions.
2. MovieBox selects `in_id`/Indonesian captions, rejects English fallback, and sends `lang=id` on search and playback operations.
3. Both adapters return a playable stream without subtitle fields when Indonesian captions are absent.
4. MovieBox S1E1 and S2E1 are stored, returned, and routed as distinct episodes.
5. Fast sync adds a new season/episode to an existing series.
6. Watch responses preserve subtitle absence and return only correctly labeled Indonesian subtitle data.
7. Subtitle proxy conversion succeeds for valid SRT/VTT sources and preserves errors for failed, empty, or invalid upstream responses.
8. Player tests cover HLS attachment, MP4 assignment, missing subtitle behavior, bounded fatal-error recovery, cleanup, and retry state.

Completion verification runs the relevant API and consumer tests, typechecks, and production builds. Browser smoke verification uses Chrome desktop and a Chrome Android viewport against reachable WeTV and MovieBox samples. For each provider it records that the watch route succeeds, the video reaches `loadedmetadata` or `playing`, fatal console/media errors are absent, and an Indonesian track loads when the selected sample advertises one. A separate no-Indonesian-subtitle fixture verifies uninterrupted playback without a track.

Live provider availability is external and may change. A failed live smoke is investigated and reported rather than hidden by fixture results.

## Deliberate simplification

`ponytail:` This design supports one Indonesian subtitle track and original audio only. Add multi-subtitle/audio selection when upstream APIs provide stable language-track metadata and product requirements request user-selectable tracks.
