# PineDrama Image Expiry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop PineDrama poster images from breaking after signed TikTok CDN URLs expire.

**Architecture:** Keep the existing `/img?u=...` proxy, but make it durable: first read/write image bytes from Cloudflare R2 using a stable key based on `hostname + pathname`, not the expiring query signature. Also correct PineDrama list/search endpoint locale params so future syncs request the documented Indonesian endpoint.

**Tech Stack:** TypeScript Sapimu providers, Cloudflare Pages Functions `_worker.js`, Cloudflare R2 binding, Node 20 assert-based checks, pnpm 9.12.0.

## Global Constraints

- No new npm dependencies.
- Keep `/img` allowlist; do not open-proxy arbitrary image hosts.
- Do not store signed query params in the durable R2 key.
- Keep existing `caches.default` as a fast edge layer, but do not rely on it for durability.
- R2 binding name: `IMAGE_CACHE`.
- R2 bucket name: `dramaplay-image-cache`.
- Use one small runnable check per non-trivial change.

---

## File Structure

- `apps/api/src/providers/sapimu/providers/pinedrama.ts`
  - Correct V2 PineDrama search/list endpoints to `language=id&region=ID`.
- `apps/api/src/providers/sapimu/batch1.ts`
  - Correct legacy PineDrama endpoints for consistency if legacy engine is used.
- `apps/consumer/public/_worker.js`
  - Add a tiny exported key helper and R2 read/write around existing `/img` proxy.
- `scripts/check-pinedrama-image-expiry.mjs`
  - Assert stable image cache key ignores expiring query params.
- `apps/consumer/wrangler.toml`
  - Pages Functions config documenting the R2 binding.
- `docs/deploy/production-deploy.md`
  - Add deployment step to create/bind the R2 bucket and resync PineDrama.

---

### Task 1: Correct PineDrama Locale Params

**Files:**
- Modify: `apps/api/src/providers/sapimu/providers/pinedrama.ts:7-11`
- Modify: `apps/api/src/providers/sapimu/batch1.ts:75-79`

**Interfaces:**
- Consumes: existing Sapimu provider endpoint string format.
- Produces: PineDrama search/list URLs using `language=id&region=ID`.

- [ ] **Step 1: Replace V2 endpoint params**

In `apps/api/src/providers/sapimu/providers/pinedrama.ts`, change the `endpoints` block to:

```ts
  endpoints: {
    trending: "/pinedrama/api/drama/search?keyword=cinta&language=id&region=ID",
    latest: "/pinedrama/api/drama/search?keyword=suami&language=id&region=ID",
    vip: "/pinedrama/api/drama/search?keyword=ceo&language=id&region=ID",
    foryou: "/pinedrama/api/drama/search?keyword=cinta&language=id&region=ID",
    search: "/pinedrama/api/drama/search?keyword={q}&language=id&region=ID",
    detail: "/pinedrama/api/drama/detail?collection_id={id}&language=id&region=ID",
    play: "/pinedrama/api/drama/play?collection_id={id}&episode={ep}&language=in&region=ID",
  },
```

- [ ] **Step 2: Replace legacy endpoint params**

In `apps/api/src/providers/sapimu/batch1.ts`, change the `pinedrama` endpoint lines to:

```ts
      trending: "/pinedrama/api/drama/search?keyword=cinta&language=id&region=ID",
      latest: "/pinedrama/api/drama/search?keyword=suami&language=id&region=ID",
      vip: "/pinedrama/api/drama/search?keyword=ceo&language=id&region=ID",
      foryou: "/pinedrama/api/drama/search?keyword=cinta&language=id&region=ID",
      search: "/pinedrama/api/drama/search?keyword={q}&language=id&region=ID",
```

- [ ] **Step 3: Run API typecheck**

Run:

```bash
pnpm --filter @dramaplay/api typecheck
```

Expected: command exits `0`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/providers/sapimu/providers/pinedrama.ts apps/api/src/providers/sapimu/batch1.ts
git commit -m "fix: use documented pinedrama locale params"
```

---

### Task 2: Add Stable Image Cache Key Check

**Files:**
- Modify: `apps/consumer/public/_worker.js:30-40,235-237`
- Create: `scripts/check-pinedrama-image-expiry.mjs`

**Interfaces:**
- Produces: `imgCacheKeyForUrl(raw: string): string`, exported from `_worker.js`.
- Later tasks consume this helper in `/img` R2 keying.

- [ ] **Step 1: Export a key helper**

In `apps/consumer/public/_worker.js`, add this function after `isAllowedImgTarget`:

```js
export function imgCacheKeyForUrl(raw) {
  const t = new URL(raw);
  return encodeURIComponent(t.hostname + t.pathname);
}
```

Then replace:

```js
      const t = new URL(target);
      const cacheKey = new Request(`https://img-cache/${encodeURIComponent(t.hostname + t.pathname)}`, { method: "GET" });
```

with:

```js
      const t = new URL(target);
      const key = imgCacheKeyForUrl(target);
      const cacheKey = new Request(`https://img-cache/${key}`, { method: "GET" });
```

- [ ] **Step 2: Create the runnable check**

Create `scripts/check-pinedrama-image-expiry.mjs`:

```js
import assert from "node:assert/strict";
import { imgCacheKeyForUrl } from "../apps/consumer/public/_worker.js";

const base = "https://p16-common-sign.tiktokcdn.com/obj/tos-maliva-p-0068/image.jpeg";

assert.equal(
  imgCacheKeyForUrl(`${base}?x-expires=1&x-signature=old`),
  imgCacheKeyForUrl(`${base}?x-expires=2&x-signature=new`),
  "signed query changes must not change the durable image key",
);

assert.notEqual(
  imgCacheKeyForUrl("https://p16-common-sign.tiktokcdn.com/obj/tos-maliva-p-0068/image-a.jpeg?x=1"),
  imgCacheKeyForUrl("https://p16-common-sign.tiktokcdn.com/obj/tos-maliva-p-0068/image-b.jpeg?x=1"),
  "different image paths must use different keys",
);

console.log("pinedrama image cache key check passed");
```

- [ ] **Step 3: Run the check**

Run:

```bash
node scripts/check-pinedrama-image-expiry.mjs
```

Expected output:

```text
pinedrama image cache key check passed
```

- [ ] **Step 4: Commit**

```bash
git add apps/consumer/public/_worker.js scripts/check-pinedrama-image-expiry.mjs
git commit -m "test: pin stable image cache key"
```

---

### Task 3: Store `/img` Bytes in R2

**Files:**
- Modify: `apps/consumer/public/_worker.js:227-256`
- Test: `scripts/check-pinedrama-image-expiry.mjs`

**Interfaces:**
- Consumes: `imgCacheKeyForUrl(raw: string): string` from Task 2.
- Consumes: optional Pages Function binding `env.IMAGE_CACHE` with R2 methods `get(key)` and `put(key, body, options)`.
- Produces: `/img` response served from R2 when edge cache is cold and upstream signed URL is expired.

- [ ] **Step 1: Replace the `/img` block with R2-first logic**

In `apps/consumer/public/_worker.js`, replace the whole `if (url.pathname === "/img") { ... }` block with:

```js
    // Image proxy for signed/expiring CDN covers: cache bytes by stable path
    // so rotating signatures don't evict the entry. Same image => same cache
    // key across signature refreshes/expiries; once cached, served from R2.
    if (url.pathname === "/img") {
      const target = url.searchParams.get("u");
      if (!target) return new Response("missing u", { status: 400 });
      if (!isAllowedImgTarget(target)) return new Response("forbidden target", { status: 403 });

      const t = new URL(target);
      const key = imgCacheKeyForUrl(target);
      const cacheKey = new Request(`https://img-cache/${key}`, { method: "GET" });
      const cache = caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      const r2 = env.IMAGE_CACHE;
      if (r2) {
        const object = await r2.get(key);
        if (object) {
          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set("Cache-Control", "public, max-age=31536000, immutable");
          headers.set("Access-Control-Allow-Origin", "*");
          const resp = new Response(object.body, { status: 200, headers });
          if (ctx) ctx.waitUntil(cache.put(cacheKey, resp.clone()));
          return resp;
        }
      }

      // HEIC isn't browser-renderable; convert via wsrv. Other formats fetch direct.
      const isHeic = /\.heic(\?|$|#)/i.test(t.pathname);
      const upstream = isHeic
        ? await fetch(`https://wsrv.nl/?url=${encodeURIComponent(target)}&output=webp&w=540`, { headers: { "User-Agent": "Mozilla/5.0" } })
        : await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!upstream.ok) return new Response("upstream error", { status: 502 });

      const contentType = isHeic ? "image/webp" : upstream.headers.get("content-type") || "image/jpeg";
      const cacheControl = "public, max-age=31536000, immutable";
      const headers = new Headers();
      headers.set("content-type", contentType);
      headers.set("Cache-Control", cacheControl);
      headers.set("Access-Control-Allow-Origin", "*");
      const resp = new Response(upstream.body, { status: 200, headers });

      const writes = [cache.put(cacheKey, resp.clone())];
      if (r2) {
        writes.push(
          r2.put(key, resp.clone().body, {
            httpMetadata: { contentType, cacheControl },
          }),
        );
      }
      // ponytail: ignore async cache write failure; response bytes already reached user.
      // Add structured logging if R2 write failures become frequent.
      if (ctx) ctx.waitUntil(Promise.all(writes).catch(() => undefined));
      else await Promise.all(writes).catch(() => undefined);
      return resp;
    }
```

- [ ] **Step 2: Run the key check**

Run:

```bash
node scripts/check-pinedrama-image-expiry.mjs
```

Expected output:

```text
pinedrama image cache key check passed
```

- [ ] **Step 3: Build consumer**

Run:

```bash
pnpm --filter @dramaplay/consumer build
```

Expected: command exits `0` and `apps/consumer/dist/_worker.js` is generated by the build.

- [ ] **Step 4: Commit**

```bash
git add apps/consumer/public/_worker.js scripts/check-pinedrama-image-expiry.mjs apps/consumer/dist/_worker.js
git commit -m "fix: persist signed provider images in r2"
```

If `apps/consumer/dist/_worker.js` is ignored by Git, commit only tracked files:

```bash
git add apps/consumer/public/_worker.js scripts/check-pinedrama-image-expiry.mjs
git commit -m "fix: persist signed provider images in r2"
```

---

### Task 4: Configure Cloudflare R2 Binding

**Files:**
- Create: `apps/consumer/wrangler.toml`
- Modify: `docs/deploy/production-deploy.md`

**Interfaces:**
- Produces: `env.IMAGE_CACHE` R2 binding for the Pages Function.
- Consumed by: Task 3 `/img` logic.

- [ ] **Step 1: Create Pages Wrangler config**

Create `apps/consumer/wrangler.toml`:

```toml
name = "dramaplay-consumer"
compatibility_date = "2026-07-07"
pages_build_output_dir = "dist"

[[r2_buckets]]
binding = "IMAGE_CACHE"
bucket_name = "dramaplay-image-cache"
```

- [ ] **Step 2: Add deploy docs**

In `docs/deploy/production-deploy.md`, under Cloudflare setup, add this section:

```md
### R2 untuk Cache Poster Provider

PineDrama dan beberapa provider memakai signed CDN image URL yang bisa expired. Consumer Pages Function memakai R2 binding `IMAGE_CACHE` untuk menyimpan bytes poster secara durable.

```bash
# dari root repo
npx wrangler r2 bucket create dramaplay-image-cache
```

Bind bucket ke Pages project `dramaplay-consumer`:

1. Cloudflare Dashboard → Workers & Pages → `dramaplay-consumer`.
2. Settings → Bindings → Add → R2 bucket.
3. Variable name: `IMAGE_CACHE`.
4. R2 bucket: `dramaplay-image-cache`.
5. Redeploy consumer.

Setelah deploy, refresh signed URL PineDrama di DB:

```bash
pnpm --filter @dramaplay/api sync:providers -- pinedrama
```

Jika script name berbeda, jalankan script sync provider yang ada di `apps/api/scripts/sync-providers.ts` dengan argumen `pinedrama`.
```

- [ ] **Step 3: Verify config syntax**

Run:

```bash
pnpm --filter @dramaplay/consumer build
```

Expected: command exits `0`.

- [ ] **Step 4: Commit**

```bash
git add apps/consumer/wrangler.toml docs/deploy/production-deploy.md
git commit -m "chore: document image cache r2 binding"
```

---

### Task 5: Production Verification

**Files:**
- No code changes.

**Interfaces:**
- Consumes: deployed consumer Pages Function with `IMAGE_CACHE` binding.
- Produces: evidence `/img` remains valid when query signature changes.

- [ ] **Step 1: Deploy consumer**

Push the branch or manually run the existing `Deploy Consumer` workflow.

Expected: GitHub Actions `Deploy Consumer` succeeds.

- [ ] **Step 2: Resync PineDrama once**

Run the existing provider sync for PineDrama so DB has fresh signed poster URLs:

```bash
pnpm --filter @dramaplay/api sync:providers -- pinedrama
```

If that script is not exposed in `package.json`, use the repo's existing script entry directly:

```bash
pnpm --filter @dramaplay/api tsx scripts/sync-providers.ts pinedrama
```

Expected: sync finishes without provider errors.

- [ ] **Step 3: Warm one PineDrama poster through `/img`**

Open any PineDrama drama page, copy its proxied image URL, then run:

```bash
curl -I "https://dramaplay.my.id/img?u=<ENCODED_PINEDRAMA_POSTER_URL>"
```

Expected headers include:

```text
HTTP/2 200
cache-control: public, max-age=31536000, immutable
access-control-allow-origin: *
```

- [ ] **Step 4: Verify R2 fallback with changed signature**

Take the original unencoded poster URL, change only query values like `x-expires` or `x-signature`, encode it, then run:

```bash
curl -I "https://dramaplay.my.id/img?u=<ENCODED_SAME_HOST_PATH_DIFFERENT_QUERY>"
```

Expected: still `HTTP/2 200` because R2 key ignores query signature.

- [ ] **Step 5: Commit verification note if desired**

If the team keeps deployment notes in docs, append the verified date/result to `docs/deploy/production-deploy.md` and commit:

```bash
git add docs/deploy/production-deploy.md
git commit -m "docs: record pinedrama image cache verification"
```

---

## Self-Review

- Spec coverage: endpoint correction, durable image storage, binding/deploy docs, and runnable checks are covered.
- Placeholder scan: no `TBD`, no undefined helper names, no unspecified tests.
- Type consistency: `IMAGE_CACHE` is used consistently in Worker code, Wrangler config, and deploy docs; `imgCacheKeyForUrl(raw)` is defined before use.
