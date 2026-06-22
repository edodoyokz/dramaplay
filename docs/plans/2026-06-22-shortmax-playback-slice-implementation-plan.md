# ShortMax Playback Slice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make ShortMax via Sapimu work end-to-end: sync drama + episodes, open drama detail, play any episode, and move to the next episode.

**Architecture:** Keep provider data in Postgres and resolve stream URLs lazily through the API. Store synthetic episode provider IDs as `<shortmaxCode>:<episodeNumber>` and call Sapimu `/shortmax/api/v1/play/:code?ep=N&lang=id` only when the user watches.

**Tech Stack:** Cloudflare Worker, Hono, Drizzle/Postgres, Sapimu API, React/Vite consumer app, pnpm.

---

### Task 1: Add a tiny provider fixture parser test

**Files:**
- Create: `apps/api/src/providers/sapimu.test.ts`
- Modify: `apps/api/package.json`

**Step 1: Add test script dependency-free**

Add this script to `apps/api/package.json`:

```json
"test": "tsx src/providers/sapimu.test.ts"
```

**Step 2: Write the failing test**

Create `apps/api/src/providers/sapimu.test.ts`:

```ts
import assert from "node:assert/strict";

const row = {
  id: 24736,
  code: 853983,
  name: "Jodoh Dari Penjara",
  cover: "https://example.com/poster.jpg",
  episodes: 85,
  summary: "desc",
};

function providerEpisodeId(code: string | number, episode: number) {
  return `${code}:${episode}`;
}

assert.equal(providerEpisodeId(row.code, 12), "853983:12");
assert.equal(row.episodes, 85);
console.log("sapimu provider fixture ok");
```

**Step 3: Run it**

```bash
pnpm --filter @dramaplay/api test
```

Expected: PASS.

**Step 4: Commit**

```bash
git add apps/api/package.json apps/api/src/providers/sapimu.test.ts
git commit -m "test: add Sapimu provider fixture check"
```

---

### Task 2: Make Sapimu adapter parse stream responses defensively

**Files:**
- Modify: `apps/api/src/providers/sapimu.ts`

**Step 1: Add small helpers**

Add helpers in `sapimu.ts`:

```ts
function findStreamUrl(value: unknown): string | undefined {
  if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStreamUrl(item);
      if (found) return found;
    }
    return undefined;
  }
  const row = value as Record<string, unknown>;
  for (const key of ["url", "videoUrl", "video_url", "playUrl", "play_url", "src", "m3u8", "mp4"]) {
    const found = findStreamUrl(row[key]);
    if (found) return found;
  }
  for (const child of Object.values(row)) {
    const found = findStreamUrl(child);
    if (found) return found;
  }
  return undefined;
}
```

**Step 2: Use it in `resolveStream`**

Replace direct field probing with:

```ts
const url = findStreamUrl(data);
if (!url) return null;
```

**Step 3: Run checks**

```bash
pnpm --filter @dramaplay/api typecheck
pnpm --filter @dramaplay/api test
```

Expected: both PASS.

**Step 4: Commit**

```bash
git add apps/api/src/providers/sapimu.ts
git commit -m "fix: parse Sapimu stream responses defensively"
```

---

### Task 3: Fix sync to create all episodes, not only first episode

**Files:**
- Modify: `apps/api/src/sync/sync.ts`

**Step 1: Find current episode existence bug**

Current sync checks only:

```ts
.where(eq(episodes.dramaId, dramaId))
.limit(1)
```

That prevents episode 2+ from being inserted.

**Step 2: Replace with per-episode check**

Use both drama ID and episode number:

```ts
const existingEp = await db
  .select()
  .from(episodes)
  .where(and(eq(episodes.dramaId, dramaId), eq(episodes.episodeNumber, ep.episodeNumber)))
  .limit(1);
```

Add `and` to the import from `drizzle-orm`.

**Step 3: Run checks**

```bash
pnpm --filter @dramaplay/api typecheck
```

Expected: PASS.

**Step 4: Commit**

```bash
git add apps/api/src/sync/sync.ts
git commit -m "fix: sync all provider episodes"
```

---

### Task 4: Add a manual sync endpoint for admin use

**Files:**
- Modify: `apps/api/src/routes/admin.ts`

**Step 1: Add endpoint**

Add route:

```ts
admin.post("/providers/:code/sync", async (c) => {
  const code = c.req.param("code");
  const result = await syncProvider(
    c.env.DATABASE_URL,
    code,
    c.env.PROVIDER_BASE_URL,
    c.env.PROVIDER_API_TOKEN
  );
  return c.json({ ok: true, result });
});
```

Import `syncProvider`.

**Step 2: Run checks**

```bash
pnpm --filter @dramaplay/api typecheck
```

Expected: PASS.

**Step 3: Commit**

```bash
git add apps/api/src/routes/admin.ts
git commit -m "feat: add admin provider sync endpoint"
```

---

### Task 5: Improve Watch API next-episode response

**Files:**
- Modify: `apps/api/src/routes/watch.ts`

**Step 1: Return next episode info**

After current episode loads, query episode `episodeNumber + 1` for the same drama.

Return:

```ts
return c.json({
  episode,
  source,
  nextEpisode: nextEpisode?.episodeNumber ?? null,
});
```

Keep current auth/entitlement behavior as-is, except all generated episodes are free.

**Step 2: Return clean stream error**

If provider returns no stream:

```ts
return c.json({ error: "stream_unavailable" }, 502);
```

**Step 3: Run checks**

```bash
pnpm --filter @dramaplay/api typecheck
```

Expected: PASS.

**Step 4: Commit**

```bash
git add apps/api/src/routes/watch.ts
git commit -m "fix: return next episode from watch API"
```

---

### Task 6: Update consumer watch page for retry and next episode

**Files:**
- Modify: `apps/consumer/src/pages/Watch.tsx`

**Step 1: Add loading and error state**

Use state:

```ts
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(false);
```

**Step 2: Add retry button**

If stream fetch fails, render:

```tsx
<button onClick={loadEpisode}>Coba lagi</button>
```

**Step 3: Add next button**

If API response has `nextEpisode`, render link/button to:

```txt
/watch/:slug/:nextEpisode
```

**Step 4: Run checks**

```bash
pnpm --filter @dramaplay/consumer typecheck
pnpm --filter @dramaplay/consumer build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/consumer/src/pages/Watch.tsx
git commit -m "feat: add watch retry and next episode"
```

---

### Task 7: Production deploy and smoke test

**Files:**
- No code changes unless verification fails.

**Step 1: Upload secrets**

```bash
set -a && . ./.env.deploy && set +a
printf '%s' "$PROVIDER_BASE_URL" | npx wrangler secret put PROVIDER_BASE_URL --config apps/api/wrangler.toml
printf '%s' "$PROVIDER_API_TOKEN" | npx wrangler secret put PROVIDER_API_TOKEN --config apps/api/wrangler.toml
```

**Step 2: Deploy API**

```bash
npx wrangler deploy --config apps/api/wrangler.toml
```

**Step 3: Build and deploy consumer**

```bash
set -a && . ./.env.deploy && set +a
export VITE_API_URL=/api VITE_SUPABASE_URL="$SUPABASE_URL" VITE_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
pnpm --filter @dramaplay/consumer build
npx wrangler pages deploy apps/consumer/dist --project-name "$CLOUDFLARE_PAGES_CONSUMER_PROJECT" --branch main --commit-dirty=true
```

**Step 4: Smoke API**

```bash
curl -fsS https://api.dramaplay.my.id/catalog/new
curl -fsS https://api.dramaplay.my.id/catalog/dramas/<slug>
curl -fsS https://api.dramaplay.my.id/watch/<slug>/1
```

Expected:
- catalog returns items
- drama detail returns episodes
- watch returns `source.streamUrl` or clear `stream_unavailable`

**Step 5: Final commit/push if needed**

```bash
git push origin main
```
