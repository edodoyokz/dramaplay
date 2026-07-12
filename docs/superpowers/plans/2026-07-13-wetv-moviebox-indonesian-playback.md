# WeTV and MovieBox Indonesian Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WeTV and MovieBox reliably playable in Chrome desktop and Chrome Android with Indonesian locale, correctly identified Indonesian subtitles, and season-aware MovieBox episodes.

**Architecture:** Keep the existing WeTV/MovieBox adapters and long-form player. Add `seasonNumber` to the existing episode contract and database row, make sync/API/UI identity use `(seasonNumber, episodeNumber)`, fail subtitle selection and proxy conversion closed, and add bounded HLS/native media recovery. Use existing Vitest, assert-based consumer tests, Hls.js, Drizzle, and browser tooling; add no dependency.

**Tech Stack:** TypeScript, React 19, Hono, Drizzle/Postgres, Vitest 3, Hls.js 1.5, Cloudflare Pages Worker, pnpm, Chrome/Playwright MCP for smoke verification.

## Global Constraints

- Do not add a dependency, provider abstraction, global store, quality selector, audio selector, or unrelated short-form refactor.
- Original audio is allowed. Indonesian dubbing is not required.
- All WeTV/MovieBox operations use Indonesian locale; WeTV retains `country=ID`.
- Only a caption positively identified as Indonesian may produce `subtitleLanguage: "id"`.
- If no Indonesian caption exists, omit subtitle fields and continue video playback.
- MovieBox episode identity is `(seasonNumber, episodeNumber)`; S1E1 and S2E1 must remain distinct.
- Validate IDs, numbers, URLs, proxy hosts, and redirects at existing trust boundaries.
- Retry must fetch a fresh watch response rather than reuse an expired source URL.
- Preserve all pre-existing user changes. The current dirty paths include `.github/workflows/daily-sync.yml`, `apps/api/src/sync/sync.ts`, `apps/api/src/sync/budget.ts`, and `apps/api/test/sync-budget.test.ts`.
- Do not edit `apps/api/src/sync/budget.ts`, `apps/api/test/sync-budget.test.ts`, or `.github/workflows/daily-sync.yml` for this feature. Patch `apps/api/src/sync/sync.ts` narrowly against its current working-tree contents.
- Do not commit unless the user explicitly authorizes commits. Each task ends with a reviewable diff checkpoint instead.
- Do not run a production migration or deploy without explicit approval. Verify the migration against a disposable/staging database first.
- `ponytail:` Support one Indonesian subtitle track and original audio. Add track selectors only when providers expose stable multi-track metadata and product requirements request them.

## File Map

- `packages/shared/src/provider/types.ts`: season-aware provider episode contract.
- `packages/db/src/schema/catalog.ts` and `packages/db/drizzle/0004_*.sql`: persisted season and composite episode uniqueness.
- `apps/api/src/providers/sapimu/wetv.ts`: strict WeTV Indonesian-caption matching.
- `apps/api/src/providers/sapimu/moviebox.ts`: MovieBox search locale, strict caption matching, season mapping.
- `apps/api/src/sync/episodes.ts`: pure composite-identity and bounded MovieBox refresh helpers.
- `apps/api/src/sync/sync.ts`: integrate season-aware discovery without overwriting budget work.
- `apps/api/src/routes/catalog.ts`: season ordering in detail responses.
- `apps/api/src/routes/watch.ts`: season-aware lookup, next episode, and honest subtitle response.
- `apps/consumer/src/lib/content-route.ts`: canonical season-aware long-form URLs.
- `apps/consumer/src/lib/local-engagement.ts`: season-aware watch progress with legacy fallback.
- `apps/consumer/src/pages/LongformDetail.tsx`: season grouping and links.
- `apps/consumer/src/lib/longform-playback.ts`: bounded HLS/native recovery helper.
- `apps/consumer/src/pages/LongformWatch.tsx`: season-aware fetch/navigation, retry, and subtitle rendering.
- `apps/consumer/public/_worker.js`: fail-closed SRT/VTT conversion while retaining proxy security.
- Existing/new tests beside the affected API/consumer code provide focused runnable checks.

---

### Task 1: Protect Existing Work and Record the Baseline

**Files:**
- Inspect only: `.github/workflows/daily-sync.yml`
- Inspect only: `apps/api/src/sync/sync.ts`
- Inspect only: `apps/api/src/sync/budget.ts`
- Inspect only: `apps/api/test/sync-budget.test.ts`

**Interfaces:**
- Consumes: current working tree.
- Produces: `/tmp/dramaplay-before-indonesian-playback.patch` as recovery evidence; no repository change.

- [ ] **Step 1: Record status and user-owned diffs**

```bash
cd /home/luckyn00b/Documents/PROJECT/dramaplay
git status --short
git diff -- .github/workflows/daily-sync.yml apps/api/src/sync/sync.ts apps/api/src/sync/budget.ts apps/api/test/sync-budget.test.ts
git diff > /tmp/dramaplay-before-indonesian-playback.patch
test -s /tmp/dramaplay-before-indonesian-playback.patch
```

Expected: the known paths remain untouched; the patch file is non-empty. Never use `reset`, `restore`, `checkout`, or `stash` on these changes.

- [ ] **Step 2: Run focused baseline checks**

```bash
pnpm --filter @dramaplay/api test -- test/wetv-provider.test.ts test/moviebox-provider.test.ts test/watch.test.ts test/sync-budget.test.ts test/sync-fetch-all.test.ts
pnpm --filter @dramaplay/api typecheck
pnpm --filter @dramaplay/consumer typecheck
node apps/consumer/test/worker-stream.test.mjs
pnpm exec tsx apps/consumer/test/content-route.test.ts
```

Expected: record exact baseline PASS/FAIL output. A pre-existing unrelated failure is evidence to preserve and report, not permission to modify unrelated code.

- [ ] **Step 3: Confirm no baseline mutation**

```bash
git status --short
git diff --check
```

Expected: no path changed by the baseline commands.

---

### Task 2: Enforce Indonesian Locale and Caption Selection

**Files:**
- Modify: `apps/api/src/providers/sapimu/wetv.ts`
- Modify: `apps/api/src/providers/sapimu/moviebox.ts`
- Modify: `apps/api/test/wetv-provider.test.ts`
- Modify: `apps/api/test/moviebox-provider.test.ts`

**Interfaces:**
- Produces: adapter results include `{ subtitleUrl, subtitleLanguage: "id" }` only for recognized Indonesian captions; both fields are absent otherwise.
- Produces: `pickMovieBoxCaption(raw): { url: string; language: "id" } | undefined`.

- [ ] **Step 1: Add failing WeTV tests**

Add table cases to `wetv-provider.test.ts` for `id`, `ID`, `id-ID`, `id_ID`, and the exact names `Indonesia`/`Bahasa Indonesia`. For every accepted row, assert:

```ts
expect(await adapter.resolveStream("cid:vid")).toMatchObject({
  subtitleUrl: "https://cdn/id.vtt",
  subtitleLanguage: "id",
});
```

Add English, unknown, and first-item-only cases and assert the exact subtitle-free result:

```ts
expect(await adapter.resolveStream("cid:vid")).toEqual({
  streamUrl: "https://cdn/play.m3u8",
  streamType: "m3u8",
});
```

Assert all recorded feed/search/detail/episodes/play URLs contain `lang=id` and `country=ID`.

- [ ] **Step 2: Verify WeTV RED**

```bash
pnpm --filter @dramaplay/api test -- test/wetv-provider.test.ts
```

Expected: FAIL because language variants are incomplete and `subs[0]` still permits non-Indonesian fallback.

- [ ] **Step 3: Implement the minimal WeTV matcher**

Add one local helper:

```ts
function isIndonesianCaption(row: Row) {
  const code = String(row.lang ?? row.language ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  const name = String(row.name ?? row.langName ?? row.lanName ?? "").trim();
  return code === "id" || code === "id-id" || /^(bahasa indonesia|indonesia)$/i.test(name);
}
```

Replace the current fallback chain with `subs.find(isIndonesianCaption)`. Spread subtitle fields only when that row has a non-empty URL:

```ts
...(subtitleUrl ? { subtitleUrl, subtitleLanguage: "id" as const } : {}),
```

- [ ] **Step 4: Add failing MovieBox tests**

Assert the search call includes `lang=id`. Test `pickMovieBoxCaption` directly:

```ts
expect(pickMovieBoxCaption([{ lan: "in_id", url: "https://cdn/id.srt" }]))
  .toEqual({ url: "https://cdn/id.srt", language: "id" });
expect(pickMovieBoxCaption([{ lan: "id-ID", url: "https://cdn/id.srt" }]))
  .toEqual({ url: "https://cdn/id.srt", language: "id" });
expect(pickMovieBoxCaption([{ lanName: "Indonesia", url: "https://cdn/id.srt" }]))
  .toEqual({ url: "https://cdn/id.srt", language: "id" });
expect(pickMovieBoxCaption([{ lan: "en", url: "https://cdn/en.srt" }]))
  .toBeUndefined();
expect(pickMovieBoxCaption([{ lan: "xx", url: "https://cdn/first.srt" }]))
  .toBeUndefined();
```

- [ ] **Step 5: Verify MovieBox RED**

```bash
pnpm --filter @dramaplay/api test -- test/moviebox-provider.test.ts
```

Expected: FAIL on search locale and English/unknown fallback.

- [ ] **Step 6: Implement the MovieBox fix**

Append `&lang=id` to the search URL. Normalize `lan`, `lang`, or `language` by lowercasing and replacing `_` with `-`; accept only `in-id`, `id`, `id-id`, or the exact Indonesian names. Return `undefined` for all other captions. Keep URL validation already used by the adapter.

- [ ] **Step 7: Verify GREEN and inspect the diff**

```bash
pnpm --filter @dramaplay/api test -- test/wetv-provider.test.ts test/moviebox-provider.test.ts
pnpm --filter @dramaplay/api typecheck
git diff --check
git diff -- apps/api/src/providers/sapimu/wetv.ts apps/api/src/providers/sapimu/moviebox.ts apps/api/test/wetv-provider.test.ts apps/api/test/moviebox-provider.test.ts
```

Expected: focused tests and typecheck PASS; no subtitle fallback remains.

---

### Task 3: Add Season to the Provider Contract

**Files:**
- Modify: `packages/shared/src/provider/types.ts`
- Modify: `apps/api/src/providers/sapimu/wetv.ts`
- Modify: `apps/api/src/providers/sapimu/moviebox.ts`
- Modify: `apps/api/test/longform-contract.test.ts`
- Modify: `apps/api/test/wetv-provider.test.ts`
- Modify: `apps/api/test/moviebox-provider.test.ts`

**Interfaces:**

```ts
export interface ProviderEpisodeSummary {
  providerEpisodeId: string;
  seasonNumber: number;
  episodeNumber: number;
  title?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}
```

Convention: WeTV and providers without seasons use `1`; MovieBox series preserve positive upstream season; MovieBox single-film tuple may use season `0` with local episode `1`.

- [ ] **Step 1: Add failing contract/provider expectations**

Use fixtures containing MovieBox S1E1 and S2E1 and assert both survive:

```ts
expect(episodes).toEqual([
  expect.objectContaining({ seasonNumber: 1, episodeNumber: 1 }),
  expect.objectContaining({ seasonNumber: 2, episodeNumber: 1 }),
]);
```

Assert WeTV episodes include `seasonNumber: 1`. Construct a typed `ProviderEpisodeSummary` with `seasonNumber` in `longform-contract.test.ts`.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @dramaplay/api test -- test/longform-contract.test.ts test/wetv-provider.test.ts test/moviebox-provider.test.ts
pnpm --filter @dramaplay/shared typecheck
```

Expected: missing-field/type failures.

- [ ] **Step 3: Add and map `seasonNumber`**

Add the required shared field. WeTV maps every episode to season `1`. MovieBox validates finite integers and rejects negative/malformed rows rather than coercing them. For a `0:0` movie row, emit `{ seasonNumber: 0, episodeNumber: 1 }`; for a series require both values to be at least `1` and preserve them in `providerEpisodeId`.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm --filter @dramaplay/api test -- test/longform-contract.test.ts test/wetv-provider.test.ts test/moviebox-provider.test.ts
pnpm --filter @dramaplay/shared typecheck
pnpm --filter @dramaplay/api typecheck
git diff --check
```

Expected: all commands PASS.

---

### Task 4: Persist Composite Season/Episode Identity

**Files:**
- Modify: `packages/db/src/schema/catalog.ts`
- Create with Drizzle: `packages/db/drizzle/0004_*.sql`
- Modify with Drizzle: `packages/db/drizzle/meta/_journal.json`
- Create with Drizzle: `packages/db/drizzle/meta/0004_snapshot.json`

**Interfaces:**
- Produces `episodes.seasonNumber: integer NOT NULL DEFAULT 1`.
- Produces unique index on `(drama_id, season_number, episode_number)`.
- Produces checks `season_number >= 0` and `episode_number > 0`.

- [ ] **Step 1: Update the Drizzle schema**

Convert `episodes` to callback form and add:

```ts
seasonNumber: integer("season_number").notNull().default(1),
```

Using existing Drizzle primitives, add:

```ts
uniqueIndex("episodes_drama_season_episode_uq").on(
  t.dramaId,
  t.seasonNumber,
  t.episodeNumber,
),
check("episodes_season_nonnegative_ck", sql`${t.seasonNumber} >= 0`),
check("episodes_episode_positive_ck", sql`${t.episodeNumber} > 0`),
```

- [ ] **Step 2: Generate migration artifacts**

```bash
pnpm --filter @dramaplay/db db:generate
```

Expected: one new numbered SQL migration, journal entry, and snapshot.

- [ ] **Step 3: Make the generated migration data-safe**

Before constraints/index, backfill MovieBox season from the existing provider tuple:

```sql
UPDATE "episodes" AS e
SET "season_number" = split_part(ep.provider_episode_id, ':', 2)::integer
FROM "episode_providers" AS ep
JOIN "providers" AS p ON p.id = ep.provider_id
WHERE ep.episode_id = e.id
  AND p.code = 'moviebox'
  AND ep.provider_episode_id ~ '^[^:]+:[0-9]+:[0-9]+$';
```

Before creating the unique index, fail without deleting data if duplicate identities remain:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "episodes"
    GROUP BY "drama_id", "season_number", "episode_number"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate episode identity after season backfill';
  END IF;
END $$;
```

Keep generated metadata consistent with the final SQL. Do not add a destructive cleanup.

- [ ] **Step 4: Inspect artifacts**

```bash
git diff -- packages/db/src/schema/catalog.ts packages/db/drizzle
rg -n 'season_number|episodes_drama_season_episode_uq|DROP|DELETE' packages/db/drizzle/0004_*.sql
pnpm --filter @dramaplay/db typecheck
```

Expected: backfill precedes checks/index; no destructive statement; typecheck PASS.

- [ ] **Step 5: Verify on a disposable database**

```bash
test -n "$DISPOSABLE_DATABASE_URL"
DATABASE_URL="$DISPOSABLE_DATABASE_URL" pnpm --filter @dramaplay/db db:migrate
```

Then verify column/index and distinct S1E1/S2E1 insertion:

```bash
psql "$DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'episodes' AND column_name = 'season_number';
SELECT indexdef FROM pg_indexes
WHERE indexname = 'episodes_drama_season_episode_uq';
BEGIN;
INSERT INTO dramas (slug, title) VALUES ('season-check', 'Season Check') RETURNING id \gset
INSERT INTO episodes (drama_id, season_number, episode_number)
VALUES (:'id', 1, 1), (:'id', 2, 1);
ROLLBACK;
SQL
```

Expected: migration succeeds; column is non-null; index exists; both rows insert. If no disposable DB is available, stop this task as unverified—do not substitute schema typecheck as migration proof.

---

### Task 5: Add Pure Season-Aware Sync Helpers

**Files:**
- Create: `apps/api/src/sync/episodes.ts`
- Create: `apps/api/test/sync-episodes.test.ts`
- Do not modify: `apps/api/src/sync/budget.ts`
- Do not modify: `apps/api/test/sync-budget.test.ts`

**Interfaces:**

```ts
export type EpisodeIdentity = {
  seasonNumber: number;
  episodeNumber: number;
};
export function episodeKey(value: EpisodeIdentity): string;
export function takeMissingEpisodes(
  incoming: ProviderEpisodeSummary[],
  existing: EpisodeIdentity[],
  maxNew: number,
): ProviderEpisodeSummary[];
export function selectEpisodeRefreshCandidates<T extends DeepFillCandidate>(
  candidates: T[],
  maxDramas: number,
  providerCode: string,
  fast: boolean,
): T[];
```

- [ ] **Step 1: Write failing helper tests**

Assert:

```ts
expect(episodeKey({ seasonNumber: 1, episodeNumber: 1 })).toBe("1:1");
expect(episodeKey({ seasonNumber: 2, episodeNumber: 1 })).toBe("2:1");
```

Assert `takeMissingEpisodes` returns S2E1 when only S1E1 exists. Assert fast MovieBox may use remaining `maxDramas` capacity for a `kind: "complete"` title, while WeTV does not. Assert selected length never exceeds the existing cap.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @dramaplay/api test -- test/sync-episodes.test.ts
```

Expected: missing module.

- [ ] **Step 3: Implement helpers using the existing budget selector**

`episodeKey` returns `` `${seasonNumber}:${episodeNumber}` ``. `takeMissingEpisodes` builds one `Set`, filters unseen composite keys, sorts by season then episode, and slices to `Math.max(0, maxNew)`.

`selectEpisodeRefreshCandidates` first calls existing `selectDeepFillCandidates`. Only when `fast && providerCode === "moviebox"` and capacity remains, append unseen `kind === "complete"` candidates until `maxDramas` is reached.

Add:

```ts
// ponytail: refresh complete MovieBox titles visible in the bounded shelf;
// add a persisted rotation cursor only if production evidence shows starvation.
```

- [ ] **Step 4: Verify GREEN without altering budget work**

```bash
pnpm --filter @dramaplay/api test -- test/sync-episodes.test.ts test/sync-budget.test.ts
pnpm --filter @dramaplay/api typecheck
git diff -- apps/api/src/sync/budget.ts apps/api/test/sync-budget.test.ts
```

Expected: tests/typecheck PASS; the last diff is byte-for-byte the pre-existing user diff.

---

### Task 6: Integrate Composite Identity into Sync

**Files:**
- Modify narrowly: `apps/api/src/sync/sync.ts`
- Modify: `apps/api/test/sync-episodes.test.ts` only if integration-level exported behavior needs coverage.

**Interfaces:**
- Consumes Task 5 helpers.
- Produces bounded discovery of new MovieBox seasons/episodes during fast sync.
- Inserts and compares episodes by composite identity.

- [ ] **Step 1: Re-read the collision file and patch only current contents**

```bash
git diff -- apps/api/src/sync/sync.ts
git diff -- apps/api/src/sync/budget.ts apps/api/test/sync-budget.test.ts
```

Expected: identify user-owned budget integration before editing.

- [ ] **Step 2: Integrate candidate selection**

Import `episodeKey`, `selectEpisodeRefreshCandidates`, and `takeMissingEpisodes` from `./episodes`. Replace only the call that selects deep-fill candidates:

```ts
const selectedDeep = selectEpisodeRefreshCandidates(
  pending,
  budgets.maxNewEpisodeDramas,
  providerCode,
  Boolean(options.fast),
);
```

Do not change budget defaults or workflow parameters.

- [ ] **Step 3: Compare and insert composite identities**

Select existing rows as:

```ts
.select({
  seasonNumber: episodes.seasonNumber,
  episodeNumber: episodes.episodeNumber,
})
```

Use `takeMissingEpisodes`. Insert both `seasonNumber` and `episodeNumber`. Build one map from `episodeKey(incoming)` to incoming provider episode and use it to write the exact `providerEpisodeId`; never look up provider IDs by episode number alone.

- [ ] **Step 4: Preserve title-wide access ordering**

Ensure free/VIP threshold applies to the ordered whole series, not independently to each repeated episode number. Use one SQL update with:

```sql
row_number() OVER (ORDER BY season_number, episode_number)
```

Do not create a new policy abstraction.

- [ ] **Step 5: Verify sync behavior and collision safety**

```bash
pnpm --filter @dramaplay/api test -- test/sync-episodes.test.ts test/sync-budget.test.ts test/sync-fetch-all.test.ts
pnpm --filter @dramaplay/api typecheck
git diff --check
git diff -- apps/api/src/sync/sync.ts
git diff -- apps/api/src/sync/budget.ts apps/api/test/sync-budget.test.ts .github/workflows/daily-sync.yml
```

Expected: tests/typecheck PASS; `sync.ts` contains only composite-identity integration on top of existing user edits; protected paths contain no new feature diff.

---

### Task 7: Make Catalog and Watch APIs Season-Aware

**Files:**
- Modify: `apps/api/src/routes/catalog.ts`
- Modify: `apps/api/src/routes/watch.ts`
- Modify: `apps/api/test/watch.test.ts`
- Create if needed: `apps/api/test/catalog-seasons.test.ts`

**Interfaces:**

Canonical endpoint:

```text
GET /watch/:slug/:season/:episode
```

Response additions/change:

```ts
seasonNumber: number;
episodeNumber: number;
subtitleUrl?: string;
subtitleLanguage?: "id";
nextEpisode: { seasonNumber: number; episodeNumber: number } | null;
```

Keep `GET /watch/:slug/:episode` temporarily as season-1 compatibility.

- [ ] **Step 1: Write failing route tests**

Extend mocked episode rows with `seasonNumber`. Assert `/test/1/1` and `/test/2/1` resolve different rows. Assert current S1E2 returns S2E1 as `nextEpisode`. Assert malformed, negative season, and zero episode return `400`.

Assert a subtitle-free provider result omits both subtitle fields. Assert a deliberately non-Indonesian provider result is neither persisted nor returned. Replace any skipped stream-unavailable placeholder with:

```ts
expect(response.status).toBe(502);
expect(await response.json()).toMatchObject({ error: "stream_unavailable" });
```

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @dramaplay/api test -- test/watch.test.ts
```

Expected: route/identity/subtitle failures.

- [ ] **Step 3: Order catalog episodes**

Use:

```ts
.orderBy(asc(episodes.seasonNumber), asc(episodes.episodeNumber));
```

Ensure the detail response exposes `seasonNumber` through its selected episode shape.

- [ ] **Step 4: Register canonical and compatibility watch routes**

Move current body into one local `serveWatch(c, seasonNumber, episodeNumber)` function. Validate canonical parameters with `Number.isInteger`, `season >= 0`, and `episode >= 1`. Compatibility route passes season `1`.

Use composite episode lookup and cache key:

```ts
`${slug}:${seasonNumber}:${episodeNumber}`
```

- [ ] **Step 5: Resolve next episode lexicographically**

Select the first episode ordered by season and episode whose tuple is greater than the current tuple. Return the object or `null`, not a bare episode number.

For the Dramanova rotating-ID refresh, match both season and episode if its adapter now emits seasons; default non-season providers to season `1`.

- [ ] **Step 6: Preserve subtitle absence honestly**

Only trust adapter subtitle data when:

```ts
source.subtitleLanguage === "id" && source.subtitleUrl
```

Remove `source.subtitleLanguage ?? "id"`. Insert only trusted Indonesian data. Return `subtitleLanguage: "id"` only when a renderable Indonesian subtitle URL is actually served. Missing subtitle remains a successful video response.

- [ ] **Step 7: Verify GREEN**

```bash
pnpm --filter @dramaplay/api test -- test/watch.test.ts test/catalog-seasons.test.ts
pnpm --filter @dramaplay/api typecheck
git diff --check
```

If catalog behavior is covered in an existing test rather than a new file, omit the nonexistent file argument. Expected: all selected tests PASS.

---

### Task 8: Make Consumer Routes, Detail, and Progress Season-Aware

**Files:**
- Modify: `apps/consumer/src/lib/content-route.ts`
- Modify: `apps/consumer/test/content-route.test.ts`
- Modify: `apps/consumer/src/lib/local-engagement.ts`
- Create: `apps/consumer/test/local-engagement.test.ts`
- Modify: `apps/consumer/src/App.tsx`
- Modify: `apps/consumer/src/pages/LongformDetail.tsx`
- Modify: `apps/consumer/src/pages/LongformWatch.tsx`
- Modify only where long-form progress links are rendered: `apps/consumer/src/pages/Home.tsx`, `apps/consumer/src/pages/Profile.tsx`

**Interfaces:**

```ts
watchPath(
  slug: string,
  episodeNumber: number,
  contentType?: ContentType | string | null,
  seasonNumber?: number,
): string;
```

Long-form path is `/title/:slug/watch/:season/:episode`. `WatchProgressItem` gains optional `seasonNumber` so legacy rows read as season `1`.

- [ ] **Step 1: Write failing path and storage tests**

```ts
assert.equal(
  watchPath("avatar", 1, "longform", 2),
  "/title/avatar/watch/2/1",
);
assert.equal(watchPath("short", 3, "shortform", 9), "/watch/short/3");
```

Use an in-memory `Storage` stub in `local-engagement.test.ts`. Assert S2E1 persists. Assert a legacy object without `seasonNumber` remains readable and consumers use `item.seasonNumber ?? 1`.

- [ ] **Step 2: Verify RED**

```bash
pnpm exec tsx apps/consumer/test/content-route.test.ts
pnpm exec tsx apps/consumer/test/local-engagement.test.ts
```

Expected: season path/type failures.

- [ ] **Step 3: Implement canonical path and app route**

Default `seasonNumber = 1` and preserve short-form paths unchanged. Add React route `/title/:slug/watch/:season/:episode`; retain `/title/:slug/watch/:n` as a temporary rendering alias for old links.

- [ ] **Step 4: Group series episodes without a dependency**

Add `seasonNumber` to the local episode response type. Reduce episodes into `Map<number, Episode[]>`, render a `Season N` heading for series, and build every link with `watchPath(..., "longform", ep.seasonNumber)`. Movies retain one watch action based on the first stored episode and do not display “Season 0”.

- [ ] **Step 5: Update progress identity and resume links**

Include `seasonNumber` on all long-form writes. Match resume state by both season and episode. Existing progress without a season defaults to `1` at the read/use boundary; do not rewrite all localStorage records. Series labels use `S{season} E{episode}`.

- [ ] **Step 6: Verify GREEN**

```bash
pnpm exec tsx apps/consumer/test/content-route.test.ts
pnpm exec tsx apps/consumer/test/local-engagement.test.ts
pnpm --filter @dramaplay/consumer typecheck
git diff --check
```

Expected: assert checks and typecheck PASS.

---

### Task 9: Fail Subtitle Proxy Conversion Closed

**Files:**
- Modify: `apps/consumer/public/_worker.js`
- Modify: `apps/consumer/test/worker-stream.test.mjs`

**Interfaces:**
- Successful SRT or flattened VTT returns non-empty valid `text/vtt`.
- Failed/empty/invalid upstream subtitle returns `502`.
- Forbidden original or redirected target remains `403`.
- Video manifest, segment, MP4, Range, and allowlist behavior remain unchanged.

- [ ] **Step 1: Add failing worker tests**

Using the existing fetch mock style, add cases for:

```js
assert.equal(failedSrt.status, 502);
assert.equal(emptySrt.status, 502);
assert.equal(invalidSrt.status, 502);
assert.equal(missingVttSegment.status, 502);
assert.equal(emptyVttPlaylist.status, 502);
assert.equal(invalidVttSegment.status, 502);
```

Keep positive SRT conversion, positive WeTV flatten, forbidden target, forbidden redirect, and Range assertions.

- [ ] **Step 2: Verify RED**

```bash
node apps/consumer/test/worker-stream.test.mjs
```

Expected: current code turns at least failed/empty subtitle inputs into HTTP 200.

- [ ] **Step 3: Add minimal cue validation**

```js
function hasSubtitleCue(text) {
  return /(?:^|\n)\d{2}:\d{2}:\d{2}[.,]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[.,]\d{3}/m.test(text);
}
```

This is deliberately not a full subtitle parser.

- [ ] **Step 4: Reject upstream/conversion failures**

After redirect validation, return `502` when subtitle upstream is not `ok`. For SRT and plain VTT, read and validate the body before returning `200`. In `flattenVttPlaylist`, throw when a required segment is forbidden, fails, redirects outside the allowlist, lacks cues, or when no segment exists. Catch flatten errors at the route and return `502`.

Do not change streaming-body behavior for HLS video manifests, TS, or MP4.

- [ ] **Step 5: Verify GREEN and security regressions**

```bash
node apps/consumer/test/worker-stream.test.mjs
git diff --check
git diff -- apps/consumer/public/_worker.js apps/consumer/test/worker-stream.test.mjs
```

Expected: valid conversions return `200 text/vtt`; invalid inputs return `502`; SSRF/redirect checks and video proxy tests remain PASS.

---

### Task 10: Add Bounded HLS and Native Media Recovery

**Files:**
- Create: `apps/consumer/src/lib/longform-playback.ts`
- Create: `apps/consumer/test/longform-playback.test.ts`
- Modify: `apps/consumer/src/pages/LongformWatch.tsx`

**Interfaces:**

```ts
export type LongformSource = {
  streamUrl: string;
  streamType: "mp4" | "m3u8" | "other";
};
export function attachLongformPlayback(
  video: HTMLVideoElement,
  source: LongformSource,
  onFailure: (message: string) => void,
  createHls?: () => Hls,
): () => void;
```

Behavior: one recovery attempt per source; second fatal failure reports once and cleans up. Returned cleanup is idempotent.

- [ ] **Step 1: Write failing helper tests with plain fakes**

Do not add jsdom or React Testing Library. A fake video implements `src`, `canPlayType`, `load`, `addEventListener`, `removeEventListener`, and an error emitter. A fake HLS implements `on`, `off`, `loadSource`, `attachMedia`, `startLoad`, `recoverMediaError`, and `destroy` counters.

Assert:

1. HLS source calls `loadSource` and `attachMedia`.
2. MP4/native source sets `video.src`.
3. First fatal HLS network error calls `startLoad`; second calls failure once and destroys once.
4. First fatal HLS media error calls `recoverMediaError`; second fails once.
5. First native media error calls `video.load`; second fails once.
6. Calling cleanup twice removes listeners and destroys at most once.

- [ ] **Step 2: Verify RED**

```bash
pnpm exec tsx apps/consumer/test/longform-playback.test.ts
```

Expected: missing module.

- [ ] **Step 3: Implement the helper**

For Hls.js, subscribe to `Hls.Events.ERROR`. When `data.fatal` is false, do nothing. Permit one supported recovery using `startLoad()` for `NETWORK_ERROR` or `recoverMediaError()` for `MEDIA_ERROR`. On a second fatal error or another fatal type, run cleanup and invoke failure exactly once.

For native playback, set `video.src`, listen for `error`, call `video.load()` once, then fail/cleanup on the second error. Cleanup removes listeners, destroys HLS once, removes `src`, and calls `load()`.

Use existing `Hls.isSupported()` and native assignment; do not add timers, retry libraries, or quality logic.

- [ ] **Step 4: Verify helper GREEN**

```bash
pnpm exec tsx apps/consumer/test/longform-playback.test.ts
pnpm --filter @dramaplay/consumer typecheck
```

Expected: tests/typecheck PASS.

- [ ] **Step 5: Integrate into `LongformWatch`**

Read `{ slug, season, episode, n }` from route params. Canonical requests call `/watch/${slug}/${season}/${episode}`; legacy `n` defaults to season `1`. Add `subtitleLanguage?: "id"`, `seasonNumber`, and object `nextEpisode` to the response type.

Replace inline HLS setup with:

```ts
return attachLongformPlayback(
  video,
  { ...data, streamUrl: playableUrl(data) },
  () => setFailed(true),
);
```

The retry button increments `retryTick`; the fetch effect clears failure/data and requests a fresh watch response. Include season in effect dependencies and progress writes.

Render subtitle only when both conditions hold:

```tsx
{data.subtitleLanguage === "id" && data.subtitleUrl ? (
  <track
    kind="subtitles"
    srcLang="id"
    label="Indonesia"
    src={subtitleProxyUrl(data.subtitleUrl)}
    default
  />
) : null}
```

Display `S{season} E{episode}` for series. Build next links from the returned season/episode object.

- [ ] **Step 6: Verify integration**

```bash
pnpm exec tsx apps/consumer/test/longform-playback.test.ts
pnpm exec tsx apps/consumer/test/content-route.test.ts
pnpm exec tsx apps/consumer/test/local-engagement.test.ts
pnpm --filter @dramaplay/consumer typecheck
pnpm --filter @dramaplay/consumer build
git diff --check
```

Expected: tests, typecheck, and production build PASS.

---

### Task 11: Run Complete Automated Verification

**Files:**
- Do not modify application files while collecting evidence.
- Create: `docs/superpowers/evidence/2026-07-13-wetv-moviebox-playback.md`

**Interfaces:**
- Produces command evidence mapped to every approved success criterion.

- [ ] **Step 1: Run focused API checks**

```bash
pnpm --filter @dramaplay/api test -- test/wetv-provider.test.ts test/moviebox-provider.test.ts test/longform-contract.test.ts test/sync-episodes.test.ts test/sync-budget.test.ts test/sync-fetch-all.test.ts test/watch.test.ts test/catalog-seasons.test.ts
pnpm --filter @dramaplay/api typecheck
```

If catalog coverage lives in an existing test, omit the nonexistent path. Expected: all selected tests PASS.

- [ ] **Step 2: Run consumer checks**

```bash
pnpm exec tsx apps/consumer/test/content-route.test.ts
pnpm exec tsx apps/consumer/test/local-engagement.test.ts
pnpm exec tsx apps/consumer/test/longform-playback.test.ts
node apps/consumer/test/worker-stream.test.mjs
pnpm --filter @dramaplay/consumer typecheck
pnpm --filter @dramaplay/consumer build
```

Expected: all checks PASS.

- [ ] **Step 3: Run repository checks**

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
git status --short
```

Expected: all available workspace tests/typechecks/builds PASS. Confirm protected user files were not overwritten and no unrequested dependency/lockfile change exists.

- [ ] **Step 4: Record evidence, not just green labels**

Write the exact command, date/time, exit status, and relevant assertion coverage to the evidence file. Include migration disposable-DB output. Do not claim locale, season identity, proxy correctness, or player recovery based only on a generic build.

---

### Task 12: Verify Actual Chrome Desktop and Android Playback

**Files:**
- Modify: `docs/superpowers/evidence/2026-07-13-wetv-moviebox-playback.md`
- Save screenshots under: `docs/superpowers/evidence/2026-07-13-playback/`

**Interfaces:**
- Consumes: a reachable local/staging build connected to migrated test/staging data and current provider credentials.
- Produces: four provider/device playback checks plus subtitle/no-subtitle evidence.

- [ ] **Step 1: Start the verified local/staging stack**

Use existing project setup commands and environment files; do not print secrets. Apply the migration only to the disposable/staging DB. Start API and consumer using existing scripts. Record the two reachable URLs.

Expected: API health and consumer shell return successful responses.

- [ ] **Step 2: Select live samples deliberately**

For each provider choose:

- one title/episode whose watch response advertises Indonesian subtitle;
- at least one provider sample without Indonesian subtitle, if live data supplies one;
- one MovieBox title with multiple seasons, if live data supplies one.

Record provider, slug, season, episode, response status, `streamType`, and subtitle presence without storing signed URLs or credentials.

- [ ] **Step 3: Chrome desktop smoke**

At a desktop viewport (for example 1440×900), open the canonical watch URL for WeTV and MovieBox. For each:

1. Wait for the watch API response.
2. Inspect the `<video>` state and record `readyState`, `networkState`, `duration`, and `currentTime` after playback begins.
3. Require `readyState >= HTMLMediaElement.HAVE_METADATA` and either a `playing` event or increasing `currentTime`.
4. Require no fatal console error and no failed manifest/video request.
5. When subtitle is advertised, require exactly one default `<track srcLang="id" label="Indonesia">`; verify its request returns valid WebVTT and reaches `loaded` or exposes cues.
6. When subtitle is absent, require zero subtitle tracks and uninterrupted video playback.
7. Save a screenshot and concise network/console evidence.

A page render, HTTP 200 watch response, or visible controls alone is not playback proof.

- [ ] **Step 4: Chrome Android smoke**

Repeat both providers in a Chrome mobile context using an Android viewport and user agent (Pixel-class 412×915 is sufficient). Require `playsInline`, metadata/playing evidence, no fatal media error, correct Indonesian track behavior, and usable retry controls. Save separate screenshots/evidence.

- [ ] **Step 5: Multi-season and retry smoke**

Open MovieBox S1E1 and S2E1 and prove canonical URLs resolve distinct stored/provider episode IDs. Confirm next navigation crosses a season boundary correctly.

Using browser request blocking or an equivalent non-production test interception, force one fatal media/network failure. Confirm one bounded recovery attempt occurs, then the visible `Coba Lagi` state appears. Click retry and verify a new `/watch/:slug/:season/:episode` request is made.

- [ ] **Step 6: Treat live uncertainty as incomplete**

If provider credentials, migrated staging DB, a multi-season title, or reachable live media are unavailable, record the missing prerequisite and do not mark the corresponding criterion verified. Fixture results are not substitutes for actual playback.

---

### Task 13: Completion Audit and Handoff

**Files:**
- Finalize: `docs/superpowers/evidence/2026-07-13-wetv-moviebox-playback.md`

- [ ] **Step 1: Build the prompt-to-artifact checklist**

Include this table with concrete evidence links/commands:

| Requirement | Artifact | Required evidence |
|---|---|---|
| WeTV language Indonesia | `wetv.ts`, provider test | all operations carry `lang=id&country=ID` |
| MovieBox language Indonesia | `moviebox.ts`, provider test | search/detail/episodes/play carry `lang=id` |
| Indonesian subtitle correctness | both adapters, watch route/tests | accepted code variants; English/unknown omitted; no invented `id` |
| Playback without Indonesian subtitle | watch/player tests and browser smoke | no `<track>` and video still reaches playable state |
| WeTV playable | proxy/player tests and desktop+Android smoke | HLS manifest/media reaches metadata/playing |
| MovieBox playable | player tests and desktop+Android smoke | MP4 reaches metadata/playing and supports normal controls |
| MovieBox multi-season | schema, migration, sync/API/UI tests and smoke | S1E1/S2E1 distinct; next navigation crosses seasons |
| Episode discovery | sync helper/integration tests | fast sync discovers a new season within existing cap |
| Proxy correctness/security | worker tests | valid SRT/VTT 200; invalid 502; forbidden target/redirect 403 |
| Recovery/retry | helper tests and forced-failure smoke | one bounded recovery; visible retry; fresh watch request |
| Android + desktop target | screenshots/evidence | both providers verified on both contexts |

- [ ] **Step 2: Inspect actual final state**

```bash
git status --short
git diff --stat
git diff --check
git diff -- pnpm-lock.yaml package.json apps/consumer/package.json apps/api/package.json
git diff -- apps/api/src/sync/budget.ts apps/api/test/sync-budget.test.ts .github/workflows/daily-sync.yml
```

Expected: no dependency addition; no whitespace errors; protected user work remains; every changed file maps to the approved objective.

- [ ] **Step 3: Identify uncovered requirements honestly**

Any missing disposable migration run, live sample, actual `playing` evidence, subtitle cue load, Android result, or multi-season sample remains explicitly **not verified**. Continue verification or report the blocker; do not infer completion from plans, fixtures, typechecks, builds, or generic health checks.

- [ ] **Step 4: Handoff**

Report the shortest useful summary: files changed, checks with exact pass counts/statuses, live smoke evidence, and any external provider limitation. Do not commit, deploy, migrate production, or open a PR unless explicitly requested.
