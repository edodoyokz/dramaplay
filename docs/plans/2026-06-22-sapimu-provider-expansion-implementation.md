# Sapimu Provider Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Sapimu batch-1 providers (`dramaboxbaru`, `dramawave`, `pinedrama`, `reelshort`, `netshort`, `dramanova`, `melolo`) as provider-specific catalog sources with quality-gated publishing and provider badges.

**Architecture:** Use a shared Sapimu base/helper plus small provider-specific adapters. Keep provider items separate: provider-prefixed slugs, no cross-provider fallback, no user-facing auto-merge. Seed new providers disabled and enable only after live smoke passes.

**Tech Stack:** Cloudflare Workers, Hono, TypeScript, Drizzle ORM, Supabase Postgres, Vitest, Sapimu API.

---

## Task 1: Add Sapimu base helper

**Files:**
- Create: `apps/api/src/providers/sapimu/base.ts`
- Test: `apps/api/test/sapimu-base.test.ts`

**Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { findStreamUrl, streamTypeFromUrl, firstArray } from "../src/providers/sapimu/base";

describe("Sapimu base helpers", () => {
  it("finds nested stream URLs", () => {
    expect(findStreamUrl({ data: { video: { video_720: "https://x.test/a.m3u8" } } })).toBe("https://x.test/a.m3u8");
  });

  it("detects stream type", () => {
    expect(streamTypeFromUrl("https://x.test/a.m3u8")).toBe("m3u8");
    expect(streamTypeFromUrl("https://x.test/a.mp4")).toBe("mp4");
    expect(streamTypeFromUrl("https://x.test/a")).toBe("other");
  });

  it("extracts first nested array", () => {
    expect(firstArray({ data: { items: [{ id: 1 }] } })).toEqual([{ id: 1 }]);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @dramaplay/api test -- sapimu-base.test.ts
```

Expected: FAIL because module does not exist.

**Step 3: Minimal implementation**

Create helper with:

- `SapimuBaseAdapter extends BaseProviderAdapter`
- `protected get<T>(path: string)` using Bearer token + User-Agent
- `findStreamUrl(value)`
- `streamTypeFromUrl(url)`
- `firstArray(value)`
- `s(value)`, `n(value)`, `unique(items, key)`

**Step 4: Run test**

Run:

```bash
pnpm --filter @dramaplay/api test -- sapimu-base.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/src/providers/sapimu/base.ts apps/api/test/sapimu-base.test.ts
git commit -m "feat(api): add Sapimu provider base helpers"
```

---

## Task 2: Add provider-prefixed slug sync behavior

**Files:**
- Modify: `apps/api/src/sync/sync.ts`
- Test: `apps/api/test/sync-slug.test.ts`

**Step 1: Write failing pure helper test**

Extract a pure helper first:

```ts
import { describe, expect, it } from "vitest";
import { providerSlug } from "../src/sync/sync";

describe("providerSlug", () => {
  it("prefixes slug with provider code", () => {
    expect(providerSlug("reelshort", "Love in the Ashes")).toBe("reelshort-love-in-the-ashes");
  });

  it("keeps same title from different providers separate", () => {
    expect(providerSlug("netshort", "Love")).not.toBe(providerSlug("reelshort", "Love"));
  });
});
```

**Step 2: Run failing test**

```bash
pnpm --filter @dramaplay/api test -- sync-slug.test.ts
```

Expected: FAIL because `providerSlug` is missing.

**Step 3: Implement minimal helper and use it**

In `syncProvider()`, replace:

```ts
const slug = slugifyTitle(item.title);
```

with:

```ts
const slug = providerSlug(providerCode, item.title);
```

Add:

```ts
export function providerSlug(providerCode: string, title: string) {
  return `${providerCode}-${slugifyTitle(title)}`;
}
```

**Step 4: Run test**

```bash
pnpm --filter @dramaplay/api test -- sync-slug.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/src/sync/sync.ts apps/api/test/sync-slug.test.ts
git commit -m "fix(api): keep provider catalog slugs separate"
```

---

## Task 3: Add provider badge to catalog/detail/watch API

**Files:**
- Modify: `apps/api/src/routes/catalog.ts`
- Modify: `apps/api/src/routes/watch.ts`
- Test: `apps/api/test/provider-badge.test.ts`

**Step 1: Write failing API tests**

Mock DB enough to assert responses include:

```json
"provider": { "code": "reelshort", "name": "ReelShort" }
```

Cover:

- `GET /catalog/trending`
- `GET /catalog/dramas/:slug`
- `GET /watch/:slug/:n`

**Step 2: Run tests**

```bash
pnpm --filter @dramaplay/api test -- provider-badge.test.ts
```

Expected: FAIL because API does not include provider.

**Step 3: Implement minimal joins**

Use existing tables:

- `dramaProviders`
- `providers`

For catalog list/detail/watch, join source provider and return:

```ts
provider: providerRow ? { code: providerRow.code, name: providerRow.name } : undefined
```

Keep cache keys unchanged except cached payload now includes provider.

**Step 4: Run tests**

```bash
pnpm --filter @dramaplay/api test -- provider-badge.test.ts
pnpm --filter @dramaplay/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/src/routes/catalog.ts apps/api/src/routes/watch.ts apps/api/test/provider-badge.test.ts
git commit -m "feat(api): include provider badges in catalog and watch"
```

---

## Task 4: Add one adapter template and verify against docs shape

**Files:**
- Create: `apps/api/src/providers/sapimu/dramawave.ts`
- Test: `apps/api/test/sapimu-dramawave.test.ts`

Use `dramawave` first because docs endpoint set is small:

```txt
/dramawave/api/v1/feed/:tab
/dramawave/api/v1/search
/dramawave/api/v1/dramas/:id
/dramawave/api/v1/dramas/:id/play/:ep
/dramawave/api/v1/languages
```

**Step 1: Write failing mapping tests**

Use sample response from `docs/providers/sapimu-scrape/docs-dramawave.html` or live probe fixture.

Assert:

- summary maps `key -> providerDramaId`
- title maps from `title`
- poster maps from `cover`
- synopsis maps from `desc`
- `providerEpisodeId` becomes `${id}:${episodeNumber}`

**Step 2: Run failing test**

```bash
pnpm --filter @dramaplay/api test -- sapimu-dramawave.test.ts
```

**Step 3: Implement `SapimuDramaWaveAdapter`**

Methods:

- `fetchForYou()` -> feed recommend or `feed/recommend`
- `fetchTrending()` -> `/dramawave/api/v1/feed/recommend?lang=id` or best available tab from docs
- `fetchLatest()` -> `/dramawave/api/v1/feed/new?lang=id`
- `fetchVip()` -> `/dramawave/api/v1/feed/vip?lang=id`
- `search(query)` -> `/dramawave/api/v1/search?q=...&lang=id&page=1`
- `fetchDetail(id)` -> `/dramawave/api/v1/dramas/${id}?lang=id`
- `fetchEpisodes(id)` -> derive from detail if docs response includes episode list/count
- `resolveStream(id:ep)` -> `/dramawave/api/v1/dramas/${id}/play/${ep}?lang=id`

**Step 4: Run tests**

```bash
pnpm --filter @dramaplay/api test -- sapimu-dramawave.test.ts
pnpm --filter @dramaplay/api typecheck
```

**Step 5: Commit**

```bash
git add apps/api/src/providers/sapimu/dramawave.ts apps/api/test/sapimu-dramawave.test.ts
git commit -m "feat(api): add Sapimu DramaWave adapter"
```

---

## Task 5: Add remaining six batch-1 adapters

**Files:**
- Create: `apps/api/src/providers/sapimu/dramaboxbaru.ts`
- Create: `apps/api/src/providers/sapimu/pinedrama.ts`
- Create: `apps/api/src/providers/sapimu/reelshort.ts`
- Create: `apps/api/src/providers/sapimu/netshort.ts`
- Create: `apps/api/src/providers/sapimu/dramanova.ts`
- Create: `apps/api/src/providers/sapimu/melolo.ts`
- Test: `apps/api/test/sapimu-batch1.test.ts`

**Step 1: Write table-driven tests**

For each provider, assert it exposes:

- `fetchLatest()` returns at least one mapped summary from fixture
- `fetchDetail(id)` maps title/synopsis/episodeCount if fixture has detail
- `resolveStream(providerEpisodeId)` finds nested stream URL from fixture

**Step 2: Run failing tests**

```bash
pnpm --filter @dramaplay/api test -- sapimu-batch1.test.ts
```

Expected: FAIL because adapters do not exist.

**Step 3: Implement minimal adapters from docs endpoints**

Use `docs/providers/sapimu-scrape/docs-endpoints.json` as source.

Provider endpoints from docs:

- `dramaboxbaru`: `/api/home`, `/api/drama/:bookId`, `/api/stream`
- `pinedrama`: `/api/drama/detail`, `/api/drama/play` or exact docs endpoint from JSON
- `reelshort`: `/api/v1/new`, `/api/v1/drama`, `/api/v1/episode`
- `netshort`: `/api/v1/feed/:page`, `/api/v1/drama/:id`, `/api/v1/episode/:id`
- `dramanova`: `/api/v1/dramas`, `/api/v1/drama/:id`, `/api/video`
- `melolo`: use docs endpoints; only publish if video/play endpoint passes smoke

Keep each adapter small. Do not make generic mapping framework.

**Step 4: Run tests**

```bash
pnpm --filter @dramaplay/api test -- sapimu-batch1.test.ts
pnpm --filter @dramaplay/api typecheck
```

**Step 5: Commit**

```bash
git add apps/api/src/providers/sapimu/*.ts apps/api/test/sapimu-batch1.test.ts
git commit -m "feat(api): add Sapimu batch one provider adapters"
```

---

## Task 6: Register adapters in provider registry

**Files:**
- Modify: `apps/api/src/providers/registry.ts`
- Test: `apps/api/test/provider-registry.test.ts`

**Step 1: Write failing registry test**

```ts
import { describe, expect, it } from "vitest";
import { buildProviders } from "../src/providers/registry";

describe("buildProviders", () => {
  it("returns Sapimu batch providers", () => {
    const providers = buildProviders("https://captain.sapimu.au", "token");
    expect(Object.keys(providers).sort()).toContain("dramaboxbaru");
    expect(Object.keys(providers).sort()).toContain("dramawave");
    expect(Object.keys(providers).sort()).toContain("pinedrama");
    expect(Object.keys(providers).sort()).toContain("reelshort");
    expect(Object.keys(providers).sort()).toContain("netshort");
    expect(Object.keys(providers).sort()).toContain("dramanova");
    expect(Object.keys(providers).sort()).toContain("melolo");
    expect(Object.keys(providers).sort()).toContain("shortmax");
  });
});
```

**Step 2: Run failing test**

```bash
pnpm --filter @dramaplay/api test -- provider-registry.test.ts
```

**Step 3: Add imports and registry entries**

Return all 8 Sapimu providers when base URL includes `sapimu.au` and token exists.

**Step 4: Run tests**

```bash
pnpm --filter @dramaplay/api test -- provider-registry.test.ts
pnpm --filter @dramaplay/api typecheck
```

**Step 5: Commit**

```bash
git add apps/api/src/providers/registry.ts apps/api/test/provider-registry.test.ts
git commit -m "feat(api): register Sapimu batch providers"
```

---

## Task 7: Seed providers disabled by default

**Files:**
- Modify: `packages/db/src/seed.ts`

**Step 1: Add provider rows**

Add rows:

```ts
{ code: "dramaboxbaru", name: "DramaBox", priority: 15, isEnabled: false },
{ code: "dramawave", name: "DramaWave", priority: 20, isEnabled: false },
{ code: "pinedrama", name: "PineDrama", priority: 25, isEnabled: false },
{ code: "reelshort", name: "ReelShort", priority: 30, isEnabled: false },
{ code: "netshort", name: "NetShort", priority: 35, isEnabled: false },
{ code: "dramanova", name: "DramaNova", priority: 40, isEnabled: false },
{ code: "melolo", name: "Melolo", priority: 45, isEnabled: false },
```

Leave existing `shortmax` enabled.

**Step 2: Typecheck**

```bash
pnpm --filter @dramaplay/db typecheck || pnpm --filter @dramaplay/api typecheck
```

Expected: PASS.

**Step 3: Commit**

```bash
git add packages/db/src/seed.ts
git commit -m "chore(db): seed Sapimu batch providers disabled"
```

---

## Task 8: Add live smoke script

**Files:**
- Create: `apps/api/scripts/smoke-sapimu-providers.ts`
- Modify: `apps/api/package.json`

**Step 1: Add smoke script**

Script:

- loads env from `.env.deploy` or process env
- builds providers
- for each batch provider:
  - `fetchLatest()`
  - first item `fetchDetail()`
  - `fetchEpisodes()`
  - `resolveStream()` episode 1
- prints matrix:

```txt
provider list detail episodes play result
reelshort OK OK OK OK PASS
melolo OK OK FAIL SKIP FAIL
```

**Step 2: Add package command**

```json
"smoke:sapimu": "tsx scripts/smoke-sapimu-providers.ts"
```

If `tsx` is not installed, use `pnpm exec tsx`; if unavailable, write a JS script. Do not add dependency unless needed.

**Step 3: Run smoke**

```bash
cd apps/api
set -a && . ../../.env.deploy && set +a
pnpm smoke:sapimu
```

Expected: Matrix output. Providers may fail; failures should not crash entire run.

**Step 4: Commit**

```bash
git add apps/api/scripts/smoke-sapimu-providers.ts apps/api/package.json
git commit -m "chore(api): add Sapimu provider smoke check"
```

---

## Task 9: Final verification

**Files:** all changed files

**Step 1: Run tests**

```bash
pnpm --filter @dramaplay/api test
```

Expected: PASS.

**Step 2: Run typecheck**

```bash
pnpm --filter @dramaplay/api typecheck
```

Expected: PASS.

**Step 3: Run smoke**

```bash
cd apps/api
set -a && . ../../.env.deploy && set +a
pnpm smoke:sapimu
```

Expected: provider matrix; do not enable failing providers.

**Step 4: Commit any smoke/doc updates**

```bash
git status --short
git add <only relevant files>
git commit -m "docs(api): record Sapimu batch smoke results"
```

---

## Rollout note

Do not enable all 7 providers automatically. They are seeded disabled. Enable one provider at a time only after smoke passes and a manual watch check works.
