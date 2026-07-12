# WeTV and MovieBox Long-form Provider Design

## Goal

Add WeTV and MovieBox to the existing provider list and Home shelves while opening their titles in dedicated film/series detail and landscape watch pages.

## Confirmed live API shapes

- WeTV: channels → feed → detail → episodes → play. Detail exposes `cid`, portrait/landscape posters, genres, category, and total episodes. Episodes expose `vid`, episode number, duration, free/pay state, and cover. Play exposes a playable URL, alternative formats, and subtitles.
- MovieBox: home content/categories → subject detail → stream. Detail exposes subject metadata, cover, country/language/rating, and episodes. Stream exposes a resource URL, resolution, and duration.
- MovieBox Shorts endpoints are out of scope.

## Architecture

Both providers remain first-class entries in the existing provider registry and appear in the same Home response as other providers. Provider metadata gains a long-form content-kind marker; content responses carry `contentType: "longform"` and `mediaType: "movie" | "series"`. Existing short-drama routes and cards remain unchanged.

Consumer routing uses the marker rather than provider-name checks:

- Existing short-form title → existing `/drama/:slug` and vertical watch flow.
- Long-form title → `/title/:slug` detail page.
- Long-form playback → `/title/:slug/watch/:episodeNumber` landscape page.
- Provider cards remain in the existing provider list; WeTV/MovieBox provider catalog cards navigate to long-form detail.

## Data flow

Daily sync maps WeTV feed and MovieBox home content into the existing catalog tables, preserving provider IDs and adding long-form metadata to `drama_providers.metadata`. The Home/catalog API returns the content marker with each card. Detail resolves metadata and episodes through the provider adapter; playback resolves the selected WeTV `vid` or MovieBox season/episode reference.

Film titles are represented as one playable episode. Series expose their actual episode list. VIP/free behavior continues to use the existing episode access rules; provider pay flags do not silently bypass Dramaplay entitlement checks.

## UI

Home gains WeTV and MovieBox shelves using the existing horizontal shelf pattern. Cards receive a compact Film/Serial label. The dedicated detail page uses a landscape hero, portrait poster, metadata, synopsis, season/episode list, and primary watch action. The watch page uses the existing stream plumbing but a landscape player layout, not `VerticalShortPlayer`.

Loading, empty, retry, report, auth, VIP purchase, navigation shell, image proxy, and local progress reuse existing behavior. No new dependency, global store, or separate application is introduced.

## Error handling and security

Provider adapters reject malformed or missing IDs/stream URLs and preserve upstream failures as recoverable API errors. Stream targets continue through the existing allowlisted proxy path rather than exposing a generic open proxy. Poster hosts are added to `/img` only after live host inspection and remain allowlisted.

## Testing

Fixture-based adapter tests cover WeTV and MovieBox list/detail/episodes/play mapping without calling paid upstream endpoints. Route tests assert the long-form marker and entitlement behavior. Consumer tests assert marker-driven routing and movie-versus-series episode handling. Verification includes API tests/typecheck, Consumer tests/typecheck/build, and a production smoke from Home card through detail to playable stream.

## Explicitly deferred

- MovieBox Shorts.
- Separate Film & Serial application or navigation hierarchy.
- Recommendations, reviews, cast pages, downloads, Chromecast, and multi-audio controls.
- Refactoring existing short-form provider architecture beyond the minimum shared content marker.
