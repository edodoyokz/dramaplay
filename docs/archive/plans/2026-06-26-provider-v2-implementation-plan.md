# Provider V2 Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor 9 Sapimu providers into modular per-provider files with a shared preset adapter, fix subtitle/backdrop persistence, behind an env-flag fallback to legacy.

**Architecture:** A `defineSapimuProvider()` config + generic `SapimuPresetAdapter` (implements `ProviderAdapter`) replaces `batch1.ts`/`sapimu.ts`/`goodshort.ts`. Each provider gets a declarative file with optional override hooks. `buildProviders` gains an `engine: "v2"|"legacy"` switch read from `SAPIMU_PROVIDER_ENGINE`. Sync gains backdrop persist + external-subtitle persist (free episodes only) + write-through on watch. Legacy stays until v2 is stable one release.

**Tech Stack:** TypeScript, Hono on Cloudflare Workers, Drizzle ORM (Postgres/Supabase), Vitest, tsx, wrangler.

**Design reference:** `docs/plans/2026-06-26-provider-v2-refactor-design.md`

**Commands:**
- Test (api): `cd apps/api && pnpm test` (vitest) or single: `pnpm vitest run test/<file> -t "<name>"`
- Typecheck: `cd apps/api && pnpm typecheck`
- Smoke live: `cd apps/api && pnpm smoke:providers` (needs `.env.deploy` creds)
- DB migration: `cd packages/db && pnpm db:generate` then `pnpm db:migrate`

**Conventions observed:**
- Vitest, tests in `apps/api/test/*.test.ts`, import from `../src/...`
- Helpers already exported from `apps/api/src/providers/sapimu/base.ts` (`findStreamUrl`, `streamTypeFromUrl`, `firstArray`, `s`, `n`, `unique`)
- `pickString`/`pickNumber` exist in base.ts but are NOT exported yet

---

## Phase 0 — DB prerequisite (unique index for subtitle upsert)

### Task 0.1: Add unique index on subtitles

**Files:**
- Modify: `packages/db/src/schema/media.ts`
- Generate: `packages/db/drizzle/000X_*.sql` (drizzle-kit)

**Step 1: Add unique index to the subtitles table definition**

In `media.ts`, the `subtitles` pgTable currently has no index. Add a second arg returning a unique index on `(episodeId, language, source)`:

```ts
import { pgTable, text, uuid, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const subtitles = pgTable(
  "subtitles",
  {
    // ...existing columns unchanged...
  },
  (t) => ({
    episodeLangSource: uniqueIndex("subtitles_episode_lang_source_uq").on(
      t.episodeId,
      t.language,
      t.source,
    ),
  }),
);
```

**Step 2: Generate migration**

Run: `cd packages/db && pnpm db:generate`
Expected: new file `packages/db/drizzle/000X_*.sql` containing `CREATE UNIQUE INDEX ... "subtitles" ("episode_id","language","source")`.

**Step 3: Verify migration SQL is correct**

Run: `grep -rn "subtitles_episode_lang_source_uq" packages/db/drizzle/`
Expected: index appears in a new migration file.

**Step 4: Apply migration**

Run: `cd packages/db && pnpm db:migrate`
Expected: applies cleanly. (If duplicate rows exist they must be deduped first; subtitles table is currently empty so this is safe.)

**Step 5: Commit**

```bash
git add packages/db/src/schema/media.ts packages/db/drizzle/
git commit -m "feat(db): unique index on subtitles (episode,language,source) for upsert"
```

---

## Phase 1 — Core v2 (extractors, types, define, adapter)

### Task 1.1: Export pickString/pickNumber/findSubtitleUrl from base for reuse

**Files:**
- Modify: `apps/api/src/providers/sapimu/base.ts` (`pickString` ~221, `pickNumber` ~230, `findSubtitleUrl` ~118 — all currently un-exported)
- Test: `apps/api/test/sapimu-base.test.ts`

**Step 1: Add failing test for exported pickString/pickNumber/findSubtitleUrl**

Append to `sapimu-base.test.ts`:

```ts
import { pickString, pickNumber, findSubtitleUrl } from "../src/providers/sapimu/base";

describe("field pickers", () => {
  it("pickString returns first present string field", () => {
    expect(pickString({ a: "", b: "x" }, ["a", "b"])).toBe("x");
  });
  it("pickNumber coerces and returns first numeric", () => {
    expect(pickNumber({ n: "3" }, ["n"])).toBe(3);
  });
  it("findSubtitleUrl finds .vtt in subtitle_list", () => {
    expect(findSubtitleUrl({ subtitle_list: [{ vtt: "https://x/a.vtt" }] })).toBe("https://x/a.vtt");
  });
});
```

**Step 2: Run, expect fail** (`not exported`)

Run: `cd apps/api && pnpm vitest run test/sapimu-base.test.ts -t "field pickers"`
Expected: FAIL (import undefined).

**Step 3: Export the functions** — change `function pickString` → `export function pickString`, same for `pickNumber` and `findSubtitleUrl`.

**Step 4: Run, expect pass.**

**Step 5: Commit**

```bash
git add apps/api/src/providers/sapimu/base.ts apps/api/test/sapimu-base.test.ts
git commit -m "refactor(api): export pickString/pickNumber/findSubtitleUrl for v2 reuse"
```

### Task 1.2: Core types (`core/types.ts`)

**Files:**
- Create: `apps/api/src/providers/sapimu/core/types.ts`

**Step 1: Write types** (no test — pure types, validated via define test in 1.4)

```ts
import type {
  ProviderDramaDetail,
  ProviderDramaSummary,
  ProviderEpisodeSummary,
  ProviderStreamSource,
} from "@dramaplay/shared";

export type SubtitlePolicy = "external" | "hardsub" | "mixed" | "unknown";

export interface ProviderSubtitle {
  url: string;
  language: string; // "id"
  format?: "vtt" | "srt";
}

export interface FieldMap {
  id: string[];
  title: string[];
  poster: string[];
  backdrop?: string[];
  episodeNumber?: string[];
}

export interface EndpointMap {
  trending: string;
  latest: string;
  foryou: string;
  vip?: string;
  search: string;
  detail: string;
  play: string;
}

export interface SapimuCtx {
  code: string;
  get<T>(path: string): Promise<T>;
  episodeId?: string;
  episodeNumber?: number;
  fields: FieldMap;
}

export interface SapimuOverrides {
  extractList?(data: unknown, ctx: SapimuCtx): unknown[];
  extractDetail?(data: unknown, ctx: SapimuCtx): Partial<ProviderDramaDetail> | undefined;
  extractEpisodes?(data: unknown, ctx: SapimuCtx): ProviderEpisodeSummary[] | undefined;
  selectStreamPayload?(data: unknown, ctx: SapimuCtx): unknown;
  normalizeStream?(data: unknown, ctx: SapimuCtx): ProviderStreamSource | undefined;
  extractSubtitle?(data: unknown, ctx: SapimuCtx): ProviderSubtitle | undefined;
}

export interface SapimuProviderDef {
  code: string;
  endpoints: EndpointMap;
  fields: FieldMap;
  subtitlePolicy: SubtitlePolicy;
  overrides?: SapimuOverrides;
}
```

**Step 2: Typecheck**

Run: `cd apps/api && pnpm typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add apps/api/src/providers/sapimu/core/types.ts
git commit -m "feat(api): provider v2 core types"
```

### Task 1.3: Media helpers (`core/media.ts`) — subtitle format detection

**Files:**
- Create: `apps/api/src/providers/sapimu/core/media.ts`
- Test: `apps/api/test/sapimu-media.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { subtitleFormatFromUrl, isRenderableSubtitle } from "../src/providers/sapimu/core/media";

describe("subtitle format", () => {
  it("detects vtt", () => expect(subtitleFormatFromUrl("https://x/a.vtt")).toBe("vtt"));
  it("detects srt", () => expect(subtitleFormatFromUrl("https://x/a.srt")).toBe("srt"));
  it("defaults srt when unknown ext", () =>
    expect(subtitleFormatFromUrl("https://x/sub?id=1")).toBe("srt"));
  it("renderable only for vtt or non-srt", () => {
    expect(isRenderableSubtitle("https://x/a.vtt")).toBe(true);
    expect(isRenderableSubtitle("https://x/a.srt")).toBe(false);
  });
});
```

**Step 2: Run, expect fail.**

**Step 3: Implement**

```ts
export function subtitleFormatFromUrl(url: string): "vtt" | "srt" {
  return /\.vtt(\?|$)/i.test(url) ? "vtt" : "srt";
}

// SRT cannot be rendered by <track>; treat explicit .srt as non-renderable.
export function isRenderableSubtitle(url: string): boolean {
  return !/\.srt(\?|$)/i.test(url);
}
```

**Step 4: Run, expect pass.**

**Step 5: Commit**

```bash
git add apps/api/src/providers/sapimu/core/media.ts apps/api/test/sapimu-media.test.ts
git commit -m "feat(api): subtitle format/renderability helpers"
```

### Task 1.4: defineSapimuProvider + validation (`core/define.ts`)

**Files:**
- Create: `apps/api/src/providers/sapimu/core/define.ts`
- Test: `apps/api/test/sapimu-define.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { defineSapimuProvider } from "../src/providers/sapimu/core/define";

const valid = {
  code: "x",
  endpoints: { trending: "/t", latest: "/l", foryou: "/f", search: "/s?q={q}", detail: "/d/{id}", play: "/p/{id}/{ep}" },
  fields: { id: ["id"], title: ["title"], poster: ["cover"] },
  subtitlePolicy: "external" as const,
};

describe("defineSapimuProvider", () => {
  it("returns def when valid", () => {
    expect(defineSapimuProvider(valid).code).toBe("x");
  });
  it("throws on missing endpoint", () => {
    expect(() => defineSapimuProvider({ ...valid, endpoints: { ...valid.endpoints, play: "" } as any })).toThrow();
  });
  it("throws on missing required field", () => {
    expect(() => defineSapimuProvider({ ...valid, fields: { id: [], title: ["t"], poster: ["c"] } })).toThrow();
  });
  it("throws on missing subtitlePolicy", () => {
    expect(() => defineSapimuProvider({ ...valid, subtitlePolicy: undefined as any })).toThrow();
  });
});
```

**Step 2: Run, expect fail.**

**Step 3: Implement**

```ts
import type { SapimuProviderDef } from "./types";

const REQUIRED_ENDPOINTS = ["trending", "latest", "foryou", "search", "detail", "play"] as const;
const REQUIRED_FIELDS = ["id", "title", "poster"] as const;

export function defineSapimuProvider(def: SapimuProviderDef): SapimuProviderDef {
  if (!def.code) throw new Error("provider def: code required");
  for (const e of REQUIRED_ENDPOINTS) {
    if (!def.endpoints?.[e]) throw new Error(`provider ${def.code}: endpoint ${e} required`);
  }
  for (const f of REQUIRED_FIELDS) {
    if (!def.fields?.[f]?.length) throw new Error(`provider ${def.code}: field ${f} required`);
  }
  if (!def.subtitlePolicy) throw new Error(`provider ${def.code}: subtitlePolicy required`);
  return def;
}
```

**Step 4: Run, expect pass.**

**Step 5: Commit**

```bash
git add apps/api/src/providers/sapimu/core/define.ts apps/api/test/sapimu-define.test.ts
git commit -m "feat(api): defineSapimuProvider with validation"
```

### Task 1.5: HTTP helper (`core/http.ts`)

**Files:**
- Create: `apps/api/src/providers/sapimu/core/http.ts`

Reuse the existing auth GET pattern from `base.ts` (`getJson` with `Authorization: Bearer`, `User-Agent: Mozilla/5.0`). Extract a thin helper so the preset adapter and `ctx.get()` share it.

**Step 1: Implement** (covered indirectly by adapter test 1.6; no standalone test — it is a fetch wrapper)

```ts
export function makeGet(baseUrl: string, token?: string) {
  return async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "User-Agent": "Mozilla/5.0",
      },
    });
    if (!res.ok) throw new Error(`sapimu ${path} -> ${res.status}`);
    return (await res.json()) as T;
  };
}
```

**Step 2: Typecheck. Step 3: Commit**

```bash
git add apps/api/src/providers/sapimu/core/http.ts
git commit -m "feat(api): sapimu v2 http get helper"
```

### Task 1.6: SapimuPresetAdapter (`core/adapter.ts`)

**Files:**
- Create: `apps/api/src/providers/sapimu/core/adapter.ts`
- Test: `apps/api/test/sapimu-adapter.test.ts`

**Step 1: Write failing test** (inject a fake `get` to avoid network)

```ts
import { describe, expect, it } from "vitest";
import { SapimuPresetAdapter } from "../src/providers/sapimu/core/adapter";
import { defineSapimuProvider } from "../src/providers/sapimu/core/define";

const def = defineSapimuProvider({
  code: "fake",
  endpoints: { trending: "/t", latest: "/l", foryou: "/f", search: "/s?q={q}", detail: "/d/{id}", play: "/p/{id}/{ep}" },
  fields: { id: ["id"], title: ["title"], poster: ["cover"], episodeNumber: ["index"] },
  subtitlePolicy: "external",
});

function adapterWith(responses: Record<string, unknown>) {
  const a = new SapimuPresetAdapter(def, "http://base", "tok");
  // @ts-expect-error override private get for test
  a.get = async (p: string) => responses[p];
  return a;
}

describe("SapimuPresetAdapter", () => {
  it("maps trending list to summaries", async () => {
    const a = adapterWith({ "/t": [{ id: "1", title: "A", cover: "c" }] });
    const out = await a.fetchTrending();
    expect(out[0]).toMatchObject({ providerDramaId: "1", title: "A", posterUrl: "c" });
  });

  it("substitutes {id}/{ep} in play path and resolves stream", async () => {
    const a = adapterWith({ "/p/9/2": { url: "https://x/a.m3u8" } });
    const s = await a.resolveStream("9:2");
    expect(s).toMatchObject({ streamUrl: "https://x/a.m3u8", streamType: "m3u8" });
  });
});
```

**Step 2: Run, expect fail.**

**Step 3: Implement adapter** using `pickString`/`pickNumber`/`firstArray`/`findStreamUrl`/`streamTypeFromUrl` from base + `findSubtitleUrl`, applying overrides when present. Must implement all `ProviderAdapter` methods: `fetchForYou` (returns `{items}`), `fetchTrending`, `fetchLatest`, `fetchVip`, `search`, `fetchDetail`, `fetchEpisodes`, `resolveStream`. Path templating: `.replace("{id}", id).replace("{ep}", ep).replace("{q}", encodeURIComponent(q))`. `resolveStream` parses `episodeId.split(":")` → `[id, ep="1"]`, builds `episodeNumber = parseInt(ep,10)`, calls `overrides.selectStreamPayload` if present else uses raw data, then `findStreamUrl` + `findSubtitleUrl`.

**Step 4: Run, expect pass. Step 5: Typecheck.**

**Step 6: Commit**

```bash
git add apps/api/src/providers/sapimu/core/adapter.ts apps/api/test/sapimu-adapter.test.ts
git commit -m "feat(api): SapimuPresetAdapter generic provider adapter"
```

---

## Phase 2 — Migrate providers (one file each)

For each provider, port endpoints/fields/overrides from current `batch1.ts` / `sapimu.ts` / `goodshort.ts`. Set `subtitlePolicy` per design mapping (external: dramawave/netshort/pinedrama; hardsub: melolo; unknown: reelshort/dramanova/dramaboxbaru/goodshort/shortmax).

### Task 2.1: index + provider files

**Files:**
- Create: `apps/api/src/providers/sapimu/providers/{dramawave,dramaboxbaru,dramanova,netshort,pinedrama,reelshort,melolo,goodshort,shortmax}.ts`
- Create: `apps/api/src/providers/sapimu/index.ts` (exports `buildSapimuProviders(baseUrl, token): Record<string, ProviderAdapter>`)
- Test: `apps/api/test/sapimu-providers-v2.test.ts`

**Per-provider source of truth:**
- 7 batch1 providers: copy `endpoints`/`fields`/quirks from `apps/api/src/providers/sapimu/batch1.ts`
- pinedrama: override fetches `language=id` subtitle after `language=in` video (port from `base.ts:438-446`)
- melolo: `selectStreamPayload` = `data.episodes.find(e => e.index === ctx.episodeNumber)` (port from `base.ts:423-432`)
- dramaboxbaru: rawStream rewrite to `${consumerOrigin}/stream?u=...` — keep in `index.ts`/adapter where consumer origin is known (carries over current `index.ts` behavior)
- shortmax: port `apps/api/src/providers/sapimu.ts`
- goodshort: port `apps/api/src/providers/sapimu/goodshort.ts` (CHANNEL_ID=562)

**Step 1: Write per-provider validation test** — each def loads without throwing and has expected `code` + `subtitlePolicy`:

```ts
import { describe, expect, it } from "vitest";
import { buildSapimuProviders } from "../src/providers/sapimu";

describe("v2 providers", () => {
  const p = buildSapimuProviders("http://base", "tok");
  for (const code of ["dramawave","dramaboxbaru","dramanova","netshort","pinedrama","reelshort","melolo","goodshort","shortmax"]) {
    it(`registers ${code}`, () => expect(p[code]).toBeTruthy());
  }
});
```

**Step 2: Run, expect fail. Step 3: Create files. Step 4: Run, expect pass. Step 5: Typecheck.**

**Step 6: Commit**

```bash
git add apps/api/src/providers/sapimu/providers/ apps/api/src/providers/sapimu/index.ts apps/api/test/sapimu-providers-v2.test.ts
git commit -m "feat(api): migrate 9 providers to v2 modular files"
```

---

## Phase 3 — Engine switch + legacy wrapper

### Task 3.1: Env flag

**Files:**
- Modify: `apps/api/src/env.ts` (add `SAPIMU_PROVIDER_ENGINE?: "v2" | "legacy"`)
- Modify: `apps/api/wrangler.toml` ([vars] `SAPIMU_PROVIDER_ENGINE = "legacy"` initial)

**Step 1: Add to Env interface + wrangler vars. Step 2: Typecheck. Step 3: Commit**

```bash
git add apps/api/src/env.ts apps/api/wrangler.toml
git commit -m "feat(api): SAPIMU_PROVIDER_ENGINE env flag"
```

### Task 3.2: registry engine switch + legacy wrapper

**Files:**
- Create: `apps/api/src/providers/sapimu/legacy.ts` (re-export current `buildBatch1Adapters` + goodshort + shortmax assembly)
- Modify: `apps/api/src/providers/registry.ts` (signature → `buildProviders(baseUrl, token?, opts?: { engine?: "v2"|"legacy" })`)
- Modify callers: `apps/api/src/routes/watch.ts:68`, `apps/api/src/sync/sync.ts:60`, `apps/api/scripts/smoke-sapimu-providers.ts:74`
- Test: `apps/api/test/registry-engine.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildProviders } from "../src/providers/registry";

describe("engine switch", () => {
  it("v2 and legacy both expose all 9 codes", () => {
    const v2 = buildProviders("http://b", "t", { engine: "v2" });
    const legacy = buildProviders("http://b", "t", { engine: "legacy" });
    const codes = ["dramawave","dramaboxbaru","dramanova","netshort","pinedrama","reelshort","melolo","goodshort","shortmax"];
    for (const c of codes) { expect(v2[c]).toBeTruthy(); expect(legacy[c]).toBeTruthy(); }
  });
  it("defaults to legacy when engine omitted", () => {
    expect(buildProviders("http://b", "t").dramawave).toBeTruthy();
  });
});
```

**Step 2: Run, expect fail. Step 3: Implement switch** (default `legacy`). Callers read `env.SAPIMU_PROVIDER_ENGINE` and pass `{ engine }`. **Step 4: Run, expect pass.**

**Step 5: Run full suite** `cd apps/api && pnpm test` — existing tests must still pass.

**Step 6: Commit**

```bash
git add apps/api/src/providers/registry.ts apps/api/src/providers/sapimu/legacy.ts apps/api/src/routes/watch.ts apps/api/src/sync/sync.ts apps/api/scripts/smoke-sapimu-providers.ts apps/api/test/registry-engine.test.ts
git commit -m "feat(api): engine switch v2|legacy in buildProviders"
```

---

## Phase 4 — Sync upgrade (backdrop + subtitle persist)

### Task 4.1: Persist backdropUrl

**Files:**
- Modify: `apps/api/src/sync/sync.ts` (insert/update branches ~line 83, 94)
- Test: `apps/api/test/sync-fetch-all.test.ts` (or new `sync-backdrop.test.ts`)

**Step 1: Add `backdropUrl: item.backdropUrl` to both the `.update(...).set(...)` and `.insert(dramas).values(...)`. Step 2: Test it is written. Step 3: Commit.**

### Task 4.2: Resolve + persist external subtitle for free episodes

**Files:**
- Modify: `apps/api/src/sync/sync.ts` (after episode insert + threshold calc)
- Test: `apps/api/test/sync-subtitle.test.ts`

**Logic:**
- Compute `threshold = Math.max(2, Math.ceil(total * 0.1))` (same as existing free/vip block)
- For inserted episodes with `episodeNumber <= threshold`, call `adapter.resolveStream(providerEpisodeId)`
- If `source.subtitleUrl`, detect format via `subtitleFormatFromUrl`, upsert into `subtitles` `(episodeId, language:"id", source:"provider", format, url, isEnabled:true)` using `.onConflictDoUpdate` on the new unique index
- Wrap each resolve in try/catch; failure increments a warn counter, never throws

**Step 1: Failing test** (mock adapter returns subtitleUrl, assert one subtitles row, run twice → still one row). **Step 2-4: implement/pass. Step 5: Commit.**

### Task 4.3: Log item-level errors

**Files:**
- Modify: `apps/api/src/sync/sync.ts` (the empty `catch {}` in item loop)

Replace `catch {}` with `catch (e) { result.errorCount++; console.warn(\`sync ${providerCode} item failed\`, String(e)); }`.

**Commit:** `fix(api): log item-level sync errors instead of swallowing`

### Task 4.4: Watch write-through + SRT guard

**Files:**
- Modify: `apps/api/src/routes/watch.ts` (`makeStreamResponse`)
- Test: `apps/api/test/watch.test.ts`

**Logic:**
- Keep DB-subtitle-first lookup
- Fallback `source.subtitleUrl` only if `isRenderableSubtitle(url)` (skip raw `.srt`)
- If fallback used and renderable, write-through upsert into `subtitles` when absent
- Hardsub policy: if no subtitle and provider policy is hardsub, omit subtitle without it being an error (already effectively true; just don't surface a warning field)

**Step 1: Failing test (SRT not returned to track; vtt returned). Step 2-4. Step 5: Commit.**

---

## Phase 5 — Validate live + cutover

### Task 5.1: Smoke v2 vs legacy

Run: `cd apps/api && SAPIMU_PROVIDER_ENGINE=v2 pnpm smoke:providers` and compare to legacy run. Expect: all 9 providers return lists + resolvable streams; melolo ep1≠ep2; dramaboxbaru segments rewritten; pinedrama H264 + id subtitle.

No code change unless smoke reveals a regression (then add targeted test + fix).

### Task 5.2: Enable v2 in production

**Files:** `apps/api/wrangler.toml` → `SAPIMU_PROVIDER_ENGINE = "v2"`. Deploy. Monitor one release.

**Commit:** `chore(api): enable provider v2 engine in production`

### Task 5.3: Delete legacy (after stable)

**Files to remove:** `apps/api/src/providers/sapimu/batch1.ts`, `apps/api/src/providers/sapimu.ts`, `apps/api/src/providers/sapimu/goodshort.ts`, `apps/api/src/providers/sapimu/legacy.ts`, and dead code in `base.ts` superseded by `core/`. Remove the `engine` branch, keep v2 only. Update tests.

**Commit:** `chore(api): remove legacy provider adapters after v2 stable`

---

## Open product decisions (non-blocking, resolve before 5.x)

- Visual confirm hardsub vs unknown per provider (melolo + 5 unknowns)
- UI subtitle/hardsub badge — defer unless needed
- Exact timing for legacy deletion (Task 5.3)

## Notes

- DRY: all extraction goes through `core/extract`/base helpers; no per-provider HTTP clients.
- YAGNI: no plugin loader, no R2 cache, no SRT→VTT converter yet (SRT stored but not served).
- TDD: every core helper + adapter + sync change has a runnable test before implementation.
- Commit after every passing task.
