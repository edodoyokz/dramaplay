# Provider Homepage Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the mixed homepage with provider shelves (including provider logos) and add a provider-specific drama list page.

**Architecture:** Add two cached catalog endpoints: `/catalog/home` for provider shelves and `/catalog/providers/:code/dramas` for provider detail lists. Provider logos are read from `providers.config.logoUrl` (no DB migration). Update the consumer app to fetch `/catalog/home`, render provider sections with logo + 3 sample dramas, and route `/provider/:code` to a paginated provider drama grid.

**Tech Stack:** Cloudflare Workers + Hono + Drizzle/Postgres API; React + Vite + React Router consumer app; Vitest for API tests.

---

### Task 0: Add provider logo config to seed data

**Files:**
- Modify: `packages/db/src/seed.ts`

**Step 1: Add `logoUrl` in provider config where official/logo asset URLs are available**

Use existing provider `config` JSON. Do not add a migration.

Example shape:

```ts
{
  code: "reelshort",
  name: "ReelShort",
  priority: 20,
  isEnabled: false,
  config: { logoUrl: "https://.../reelshort.png" },
}
```

If official URLs are not available yet, leave `logoUrl` unset. The frontend must render generated initials in the logo slot, so the redesign is not blocked.

**Step 2: Run seed only when ready for the target DB**

For production, do not run seed blindly if it may reset data. If seed uses upsert, run the existing seed command. Otherwise, add/update logos with a small SQL update script.

**Step 3: Commit**

```bash
git add packages/db/src/seed.ts
git commit -m "chore(db): add provider logo config"
```

---

### Task 1: Add API route tests for provider homepage

**Files:**
- Modify: `apps/api/test/provider-badge.test.ts`

**Step 1: Add lightweight pure helpers in the test**

Append tests that define minimal pure functions matching the intended API behavior. This avoids complex Hono DB mocking.

```ts
function buildHomeShelves(rows: any[], limit = 3) {
  const grouped = new Map<string, any>();
  for (const r of rows) {
    if (!r.providerEnabled || !r.isPublished || r.visibility !== "public" || !r.isPrimary) continue;
    const key = r.providerCode;
    if (!grouped.has(key)) {
      grouped.set(key, {
        code: r.providerCode,
        name: r.providerName,
        logoUrl: r.providerLogoUrl ?? null,
        priority: r.providerPriority,
        dramaCount: 0,
        episodeCount: 0,
        items: [],
      });
    }
    const shelf = grouped.get(key);
    shelf.dramaCount += 1;
    shelf.episodeCount += r.episodeCount ?? 0;
    if (shelf.items.length < limit) {
      shelf.items.push({
        id: r.id,
        slug: r.slug,
        title: r.title,
        posterUrl: r.posterUrl,
        episodeCount: r.episodeCount,
        provider: { code: r.providerCode, name: r.providerName },
      });
    }
  }
  return [...grouped.values()].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}
```

**Step 2: Add tests**

```ts
it("home shelves group by enabled provider and keep max 3 dramas", () => {
  const rows = Array.from({ length: 4 }, (_, i) => ({
    id: `d${i}`,
    slug: `reelshort-d${i}`,
    title: `Drama ${i}`,
    posterUrl: "p.jpg",
    episodeCount: 10,
    isPublished: true,
    visibility: "public",
    isPrimary: true,
    providerEnabled: true,
    providerCode: "reelshort",
    providerName: "ReelShort",
    providerPriority: 2,
  }));

  const shelves = buildHomeShelves(rows);
  expect(shelves).toHaveLength(1);
  expect(shelves[0].dramaCount).toBe(4);
  expect(shelves[0].episodeCount).toBe(40);
  expect(shelves[0].items).toHaveLength(3);
  expect(shelves[0].items[0].provider).toEqual({ code: "reelshort", name: "ReelShort" });
});

it("home shelves omit disabled providers", () => {
  const shelves = buildHomeShelves([
    {
      id: "d1",
      slug: "x",
      title: "X",
      posterUrl: null,
      episodeCount: 1,
      isPublished: true,
      visibility: "public",
      isPrimary: true,
      providerEnabled: false,
      providerCode: "disabled",
      providerName: "Disabled",
      providerPriority: 1,
    },
  ]);
  expect(shelves).toEqual([]);
});
```

**Step 3: Run test**

```bash
pnpm --filter @dramaplay/api test -- provider-badge
```

Expected: pass.

**Step 4: Commit**

```bash
git add apps/api/test/provider-badge.test.ts
git commit -m "test(api): provider homepage shelf behavior"
```

---

### Task 2: Add `/catalog/home` endpoint

**Files:**
- Modify: `apps/api/src/routes/catalog.ts`

**Step 1: Import needed helpers**

Update import:

```ts
import { eq, desc, asc, sql, and } from "drizzle-orm";
```

**Step 2: Add small item mapper**

Near `withBadge`, add:

```ts
function dramaItem(r: any) {
  return withBadge(r);
}
```

If TypeScript complains, skip this helper and inline `rows.map(withBadge)`.

**Step 3: Add endpoint before `/trending`**

```ts
catalog.get("/home", async (c) => {
  const hit = cached("home");
  if (hit) return c.json(hit);

  const db = createDb(c.env.DATABASE_URL);
  const providerRows = await db
    .select({
      id: providers.id,
      code: providers.code,
      name: providers.name,
      priority: providers.priority,
      config: providers.config,
    })
    .from(providers)
    .where(eq(providers.isEnabled, true))
    .orderBy(asc(providers.priority), asc(providers.name));

  const shelves = [];
  for (const p of providerRows) {
    const rows = await db
      .select({
        id: dramas.id,
        slug: dramas.slug,
        title: dramas.title,
        posterUrl: dramas.posterUrl,
        backdropUrl: dramas.backdropUrl,
        country: dramas.country,
        year: dramas.year,
        genres: dramas.genres,
        rating: dramas.rating,
        episodeCount: dramas.episodeCount,
        popularityScore: dramas.popularityScore,
        providerCode: providers.code,
        providerName: providers.name,
      })
      .from(dramas)
      .innerJoin(dramaProviders, eq(dramas.id, dramaProviders.dramaId))
      .innerJoin(providers, eq(dramaProviders.providerId, providers.id))
      .where(
        and(
          eq(providers.id, p.id),
          eq(dramas.isPublished, true),
          eq(dramas.visibility, "public"),
          eq(dramaProviders.isPrimary, true)
        )
      )
      .orderBy(desc(dramas.popularityScore), desc(dramas.createdAt))
      .limit(3);

    if (rows.length === 0) continue;

    shelves.push({
      code: p.code,
      name: p.name,
      logoUrl: typeof p.config?.logoUrl === "string" ? p.config.logoUrl : null,
      dramaCount: rows.length, // ponytail: exact count can wait; sample count is enough for v1
      episodeCount: rows.reduce((sum, r) => sum + (r.episodeCount ?? 0), 0),
      items: rows.map(withBadge),
    });
  }

  const body = { providers: shelves };
  store("home", body);
  return c.json(body);
});
```

Note: this uses 1 query for providers + 1 small query per provider. For 8-40 providers with 120s cache, this is acceptable. Do not add window functions unless CPU/DB metrics prove this path is hot.

**Step 4: Run typecheck**

```bash
pnpm --filter @dramaplay/api typecheck
```

Expected: pass.

**Step 5: Manual API check locally if env is available**

```bash
cd apps/api
set -a && source ../../.env.deploy && set +a
npx wrangler dev --remote
# in another shell:
curl http://localhost:8787/catalog/home | jq '.providers[0]'
```

Expected: provider object with 1-3 items.

**Step 6: Commit**

```bash
git add apps/api/src/routes/catalog.ts
git commit -m "feat(api): add provider-shelf catalog home"
```

---

### Task 3: Add `/catalog/providers/:code/dramas` endpoint

**Files:**
- Modify: `apps/api/src/routes/catalog.ts`

**Step 1: Add route before `/dramas/:slug`**

Important: put this route before `/dramas/:slug` for clarity, even though paths do not conflict.

```ts
catalog.get("/providers/:code/dramas", async (c) => {
  const code = c.req.param("code");
  const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 20) || 20));
  const key = `provider:${code}:${page}:${limit}`;
  const hit = cached(key);
  if (hit) return c.json(hit);

  const db = createDb(c.env.DATABASE_URL);
  const [provider] = await db
    .select({ id: providers.id, code: providers.code, name: providers.name, config: providers.config })
    .from(providers)
    .where(and(eq(providers.code, code), eq(providers.isEnabled, true)));

  if (!provider) return c.json({ error: "provider_not_found" }, 404);

  const rows = await db
    .select({
      id: dramas.id,
      slug: dramas.slug,
      title: dramas.title,
      posterUrl: dramas.posterUrl,
      backdropUrl: dramas.backdropUrl,
      country: dramas.country,
      year: dramas.year,
      genres: dramas.genres,
      rating: dramas.rating,
      episodeCount: dramas.episodeCount,
      popularityScore: dramas.popularityScore,
      providerCode: providers.code,
      providerName: providers.name,
    })
    .from(dramas)
    .innerJoin(dramaProviders, eq(dramas.id, dramaProviders.dramaId))
    .innerJoin(providers, eq(dramaProviders.providerId, providers.id))
    .where(
      and(
        eq(providers.id, provider.id),
        eq(dramas.isPublished, true),
        eq(dramas.visibility, "public"),
        eq(dramaProviders.isPrimary, true)
      )
    )
    .orderBy(desc(dramas.popularityScore), desc(dramas.createdAt))
    .limit(limit + 1)
    .offset((page - 1) * limit);

  const body = {
    provider: {
      code: provider.code,
      name: provider.name,
      logoUrl: typeof provider.config?.logoUrl === "string" ? provider.config.logoUrl : null,
    },
    items: rows.slice(0, limit).map(withBadge),
    page,
    limit,
    hasMore: rows.length > limit,
  };
  store(key, body);
  return c.json(body);
});
```

**Step 2: Run typecheck**

```bash
pnpm --filter @dramaplay/api typecheck
```

Expected: pass.

**Step 3: Manual API check**

```bash
curl "http://localhost:8787/catalog/providers/reelshort/dramas?page=1&limit=5" | jq '.provider,.items|length'
```

Expected: provider `reelshort`, 5 items, `hasMore` true if more than 5.

**Step 4: Commit**

```bash
git add apps/api/src/routes/catalog.ts
git commit -m "feat(api): add provider drama list endpoint"
```

---

### Task 4: Add consumer provider page route

**Files:**
- Create: `apps/consumer/src/pages/ProviderDramas.tsx`
- Modify: `apps/consumer/src/App.tsx`

**Step 1: Create `ProviderDramas.tsx`**

Use the existing card style from `Home.tsx`. Keep it minimal.

```tsx
import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type Drama = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  country: string | null;
  year: number | null;
  rating: number;
  episodeCount: number;
  provider?: { code: string; name: string };
};

type ProviderResponse = {
  provider: { code: string; name: string; logoUrl?: string | null };
  items: Drama[];
  page: number;
  limit: number;
  hasMore: boolean;
};

export default function ProviderDramas() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<ProviderResponse["provider"] | null>(null);
  const [items, setItems] = useState<Drama[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextPage: number) {
    setLoading(true);
    setError("");
    try {
      const res = await api<ProviderResponse>(`/catalog/providers/${code}/dramas?page=${nextPage}&limit=24`);
      setProvider(res.provider);
      setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items]));
      setPage(res.page);
      setHasMore(res.hasMore);
    } catch {
      setError(nextPage === 1 ? "Provider tidak ditemukan." : "Gagal memuat halaman berikutnya.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setItems([]);
    setPage(1);
    load(1);
  }, [code]);

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 pb-12">
      <header className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3 bg-black/60 backdrop-blur-md border-b border-zinc-900/60">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-300 hover:text-white" aria-label="Kembali">
          ←
        </button>
        <ProviderLogo name={provider?.name ?? code} logoUrl={provider?.logoUrl} />
        <div>
          <p className="text-[10px] uppercase tracking-widest text-rose-400 font-bold">Provider</p>
          <h1 className="text-lg font-extrabold">{provider?.name ?? code}</h1>
        </div>
      </header>

      <main className="px-4 mt-5">
        {error && items.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-3">
          {items.map((d) => (
            <DramaCard key={d.id} drama={d} />
          ))}
        </div>

        {loading && <p className="py-6 text-center text-xs text-zinc-500">Memuat...</p>}

        {error && items.length > 0 ? (
          <button onClick={() => load(page + 1)} className="mt-5 w-full rounded-full border border-zinc-800 py-2 text-sm text-zinc-300">
            Coba lagi
          </button>
        ) : null}

        {!loading && hasMore ? (
          <button onClick={() => load(page + 1)} className="mt-6 w-full rounded-full bg-rose-500 py-2.5 text-sm font-bold text-white">
            Muat Lagi
          </button>
        ) : null}
      </main>
    </div>
  );
}

function ProviderLogo({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-extrabold text-rose-400">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function DramaCard({ drama: d }: { drama: Drama }) {
  return (
    <Link to={`/drama/${d.slug}`} className="block group">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800/80">
        {d.posterUrl ? <img src={d.posterUrl} alt={d.title} className="h-full w-full object-cover" loading="lazy" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-1.5 left-1.5">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 text-rose-400 border border-rose-500/20">
            {d.episodeCount || 0} Eps
          </span>
        </div>
      </div>
      <h4 className="mt-2 truncate text-xs font-semibold text-zinc-300 group-hover:text-white">{d.title}</h4>
      <p className="text-[9px] text-zinc-500 mt-0.5">{d.year || "2026"} • {d.country || "ID"}</p>
    </Link>
  );
}
```

**Step 2: Register route in `App.tsx`**

Import:

```tsx
import ProviderDramas from "./pages/ProviderDramas";
```

Add route:

```tsx
<Route path="/provider/:code" element={<ProviderDramas />} />
```

**Step 3: Run consumer typecheck**

```bash
pnpm --filter @dramaplay/consumer typecheck
```

Expected: pass.

**Step 4: Commit**

```bash
git add apps/consumer/src/pages/ProviderDramas.tsx apps/consumer/src/App.tsx
git commit -m "feat(consumer): add provider drama page"
```

---

### Task 5: Redesign consumer homepage to provider shelves

**Files:**
- Modify: `apps/consumer/src/pages/Home.tsx`

**Step 1: Update types**

Add provider to `Drama`:

```ts
provider?: { code: string; name: string };
```

Add shelf type:

```ts
interface ProviderShelf {
  code: string;
  name: string;
  logoUrl?: string | null;
  dramaCount: number;
  episodeCount: number;
  items: Drama[];
}
```

**Step 2: Replace state**

Remove:

```ts
const [trending, setTrending] = useState<Drama[]>([]);
const [fresh, setFresh] = useState<Drama[]>([]);
const [selectedGenre, setSelectedGenre] = useState("Semua");
```

Add:

```ts
const [shelves, setShelves] = useState<ProviderShelf[]>([]);
const [loadingHome, setLoadingHome] = useState(true);
const [homeError, setHomeError] = useState(false);
```

**Step 3: Replace catalog fetches**

Replace `/catalog/trending` and `/catalog/new` calls with:

```ts
setLoadingHome(true);
api<{ providers: ProviderShelf[] }>("/catalog/home")
  .then((r) => {
    setShelves(r.providers);
    setHomeError(false);
  })
  .catch(() => {
    setShelves([]);
    setHomeError(true);
  })
  .finally(() => setLoadingHome(false));
```

Keep VIP check unchanged.

**Step 4: Remove hero and genre filter blocks**

Delete:

- `GENRES`
- `filterDramas`
- `heroDrama`
- `filteredTrending`
- `filteredFresh`
- Hero banner JSX
- Genre carousel JSX

Keep Continue Watching, but remove `selectedGenre === "Semua"` condition.

**Step 5: Replace final sections**

Replace:

```tsx
<div className="mt-8 px-4 space-y-8">
  <Section title="Trending Sekarang" items={filteredTrending} />
  <Section title="Drama Terbaru" items={filteredFresh} />
</div>
```

With:

```tsx
<div className="mt-8 px-4 space-y-8">
  {loadingHome ? <p className="text-center text-xs text-zinc-500">Memuat provider...</p> : null}
  {homeError ? (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
      Gagal memuat katalog. Coba buka ulang halaman.
    </div>
  ) : null}
  {shelves.map((shelf) => (
    <ProviderSection key={shelf.code} shelf={shelf} />
  ))}
</div>
```

**Step 6: Replace `Section` component with `ProviderSection`**

```tsx
function ProviderSection({ shelf }: { shelf: ProviderShelf }) {
  if (shelf.items.length === 0) return null;

  return (
    <section className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ProviderLogo name={shelf.name} logoUrl={shelf.logoUrl} />
          <div>
            <h3 className="text-md font-bold text-white tracking-wide">{shelf.name}</h3>
            <p className="text-[10px] text-zinc-500">
              {shelf.dramaCount} drama • {shelf.episodeCount} episode
            </p>
          </div>
        </div>
        <Link to={`/provider/${shelf.code}`} className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
          Lihat Semua
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {shelf.items.map((d) => (
          <DramaCard key={d.id} drama={d} />
        ))}
      </div>
    </section>
  );
}
```

Add the same small `ProviderLogo` helper used in `ProviderDramas.tsx` above the section component. Extract existing card JSX into `DramaCard` so `ProviderDramas.tsx` can optionally duplicate or later share it. Do not over-abstract into a components folder yet unless duplicate code becomes painful.

**Step 7: Run consumer typecheck**

```bash
pnpm --filter @dramaplay/consumer typecheck
```

Expected: pass.

**Step 8: Commit**

```bash
git add apps/consumer/src/pages/Home.tsx
git commit -m "feat(consumer): redesign homepage as provider shelves"
```

---

### Task 6: End-to-end verification and deployment

**Files:**
- None unless fixes are needed.

**Step 1: Run all checks**

```bash
pnpm --filter @dramaplay/api typecheck
pnpm --filter @dramaplay/api test
pnpm --filter @dramaplay/consumer typecheck
pnpm --filter @dramaplay/consumer build
```

Expected: all pass.

**Step 2: Verify API manually**

```bash
cd apps/api
set -a && source ../../.env.deploy && set +a
npx wrangler deploy
curl -s https://api.dramaplay.my.id/catalog/home | jq '.providers | length'
curl -s 'https://api.dramaplay.my.id/catalog/providers/reelshort/dramas?page=1&limit=3' | jq '.provider,.items|length'
```

Expected:

- `/catalog/home`: non-zero provider count
- provider detail: provider object + 3 items

**Step 3: Build/deploy consumer**

Use the existing deployment path for `apps/consumer`. If no deploy target exists, at minimum run:

```bash
pnpm --filter @dramaplay/consumer build
```

Expected: Vite build succeeds.

**Step 4: Manual browser check**

Check:

- Homepage loads provider sections.
- Each provider section has 3 dramas max.
- `Lihat Semua` opens `/provider/:code`.
- Provider page loads 24 dramas max and `Muat Lagi` appends more.
- Drama card opens detail page.
- Watch still works from detail.

**Step 5: Commit verification fixes, if any**

```bash
git status --short
git add <changed-files>
git commit -m "fix: provider homepage verification fixes"
```

Only commit if fixes were needed.
