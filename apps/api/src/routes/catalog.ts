import { Hono } from "hono";
import { createDb, dramas, episodes, dramaProviders, providers } from "@dramaplay/db";
import { eq, desc, asc, sql, and } from "drizzle-orm";
import { resolveContentKind } from "@dramaplay/shared";
import type { ProviderShelfMembership } from "@dramaplay/shared";
import type { Env } from "../env";

export const catalog = new Hono<{ Bindings: Env }>();

// ponytail: in-isolate cache, naive size cap. 120s TTL on static-ish catalog reads.
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 120_000;
const MAX = 500;

function cached<T>(key: string): T | null {
  const hit = cache.get(key);
  return hit && Date.now() - hit.ts < TTL ? (hit.data as T) : null;
}
function store(key: string, data: unknown) {
  if (cache.size > MAX) cache.clear();
  cache.set(key, { data, ts: Date.now() });
}

function withBadge<
  T extends {
    providerCode: string | null;
    providerName: string | null;
    providerMetadata?: Record<string, unknown> | null;
    providerConfig?: Record<string, unknown> | null;
    episodeCount?: number | null;
  },
>(r: T) {
  const kind = resolveContentKind({
    contentType: typeof r.providerMetadata?.contentType === "string" ? r.providerMetadata.contentType : null,
    mediaType: typeof r.providerMetadata?.mediaType === "string" ? r.providerMetadata.mediaType : null,
    providerContentType: typeof r.providerConfig?.contentType === "string" ? r.providerConfig.contentType : null,
    episodeCount: r.episodeCount,
  });
  return {
    ...r,
    contentType: kind.contentType,
    mediaType: kind.mediaType,
    provider: r.providerCode
      ? {
          code: r.providerCode,
          name: r.providerName ?? r.providerCode,
          contentType: kind.contentType,
        }
      : undefined,
  };
}

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
        providerMetadata: dramaProviders.metadata,
        providerConfig: providers.config,
      })
      .from(dramas)
      .innerJoin(dramaProviders, eq(dramas.id, dramaProviders.dramaId))
      .innerJoin(providers, eq(dramaProviders.providerId, providers.id))
      .where(
        and(
          eq(providers.id, p.id),
          eq(dramas.isPublished, true),
          eq(dramas.visibility, "public"),
          eq(dramaProviders.isPrimary, true),
        ),
      )
      .orderBy(desc(dramas.popularityScore), desc(dramas.createdAt))
      .limit(3);

    if (rows.length === 0) continue;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(dramas)
      .innerJoin(dramaProviders, eq(dramas.id, dramaProviders.dramaId))
      .where(
        and(
          eq(dramaProviders.providerId, p.id),
          eq(dramas.isPublished, true),
          eq(dramas.visibility, "public"),
          eq(dramaProviders.isPrimary, true),
        ),
      );

    const [{ totalEps }] = await db
      .select({ totalEps: sql<number>`coalesce(sum(${dramas.episodeCount}),0)::int` })
      .from(dramas)
      .innerJoin(dramaProviders, eq(dramas.id, dramaProviders.dramaId))
      .where(
        and(
          eq(dramaProviders.providerId, p.id),
          eq(dramas.isPublished, true),
          eq(dramas.visibility, "public"),
          eq(dramaProviders.isPrimary, true),
        ),
      );

    const contentType =
      typeof p.config?.contentType === "string" && p.config.contentType === "longform"
        ? "longform"
        : "shortform";
    shelves.push({
      code: p.code,
      name: p.name,
      logoUrl: typeof p.config?.logoUrl === "string" ? p.config.logoUrl : null,
      contentType,
      dramaCount: count,
      episodeCount: totalEps,
      items: rows.map(withBadge),
    });
  }

  const body = { providers: shelves };
  store("home", body);
  return c.json(body);
});

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
      providerMetadata: dramaProviders.metadata,
      providerConfig: providers.config,
    })
    .from(dramas)
    .innerJoin(dramaProviders, eq(dramas.id, dramaProviders.dramaId))
    .innerJoin(providers, eq(dramaProviders.providerId, providers.id))
    .where(
      and(
        eq(providers.id, provider.id),
        eq(dramas.isPublished, true),
        eq(dramas.visibility, "public"),
        eq(dramaProviders.isPrimary, true),
      ),
    )
    .orderBy(desc(dramas.popularityScore), desc(dramas.createdAt))
    .limit(limit + 1)
    .offset((page - 1) * limit);

  const contentType =
    typeof provider.config?.contentType === "string" && provider.config.contentType === "longform"
      ? "longform"
      : "shortform";
  const body = {
    provider: {
      code: provider.code,
      name: provider.name,
      logoUrl: typeof provider.config?.logoUrl === "string" ? provider.config.logoUrl : null,
      contentType,
    },
    items: rows.slice(0, limit).map(withBadge),
    page,
    limit,
    hasMore: rows.length > limit,
  };
  store(key, body);
  return c.json(body);
});

// --- Provider-native landing + category helpers (pure, testable) ---

interface LandingRow {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  country: string | null;
  year: number | null;
  genres: string[] | null;
  rating: number | null;
  episodeCount: number | null;
  popularityScore: number | null;
  providerCode: string | null;
  providerName: string | null;
  providerMetadata: Record<string, unknown> | null;
  providerConfig: Record<string, unknown> | null;
  providerDramaId: string;
}

const SHELF_PREVIEW = 10;

export function parseShelfMemberships(meta: unknown): ProviderShelfMembership[] {
  if (!meta || typeof meta !== "object") return [];
  const arr = (meta as { shelves?: unknown }).shelves;
  if (!Array.isArray(arr)) return [];
  return arr.filter(
    (s): s is ProviderShelfMembership =>
      !!s &&
      typeof s === "object" &&
      typeof (s as Record<string, unknown>).code === "string" &&
      typeof (s as Record<string, unknown>).name === "string" &&
      typeof (s as Record<string, unknown>).position === "number",
  );
}

interface ShelfGroup {
  code: string;
  name: string;
  items: { row: LandingRow; position: number }[];
}

export function groupShelves(rows: LandingRow[]): ShelfGroup[] {
  const map = new Map<string, ShelfGroup>();
  for (const row of rows) {
    for (const m of parseShelfMemberships(row.providerMetadata)) {
      let g = map.get(m.code);
      if (!g) {
        g = { code: m.code, name: m.name, items: [] };
        map.set(m.code, g);
      }
      g.items.push({ row, position: m.position });
    }
  }
  for (const g of map.values()) g.items.sort((a, b) => a.position - b.position);
  return [...map.values()];
}

const HERO_PREFERRED: Record<string, string[]> = {
  wetv: ["Featured Free Content", "Untukmu"],
  moviebox: ["Popular", "TOP100"],
};

export function pickHero(shelves: ShelfGroup[], providerCode: string) {
  const preferred = HERO_PREFERRED[providerCode] ?? [];
  for (const name of preferred) {
    const g = shelves.find((s) => s.name === name);
    if (g && g.items.length) return g;
  }
  return null;
}

export function orderShelves(
  shelves: ShelfGroup[],
  config: Record<string, unknown> | null,
  providerCode: string,
): ShelfGroup[] {
  const hero = pickHero(shelves, providerCode);
  const configOrder: string[] = Array.isArray(config?.shelves)
    ? (config!.shelves as { code?: unknown }[])
        .map((s) => (typeof s?.code === "string" ? s.code : ""))
        .filter(Boolean)
    : [];
  const rank = (g: ShelfGroup) => {
    if (hero && g.code === hero.code) return -1;
    if (configOrder.length) {
      const i = configOrder.indexOf(g.code);
      if (i >= 0) return i;
    }
    return shelves.indexOf(g);
  };
  return [...shelves].sort((a, b) => rank(a) - rank(b));
}

export interface LandingResponse {
  provider: { code: string; name: string; logoUrl: string | null; contentType: string };
  hero: ReturnType<typeof withBadge> | null;
  shelves: { code: string; name: string; items: ReturnType<typeof withBadge>[]; hasMore: boolean }[];
}

export function buildLanding(
  provider: { code: string; name: string; config: Record<string, unknown> | null },
  rows: LandingRow[],
): LandingResponse {
  const groups = groupShelves(rows);
  const ordered = orderShelves(groups, provider.config, provider.code);
  const heroGroup = pickHero(groups, provider.code);
  const heroRow = heroGroup?.items[0]?.row ?? null;

  const contentType =
    typeof provider.config?.contentType === "string" && provider.config.contentType === "longform"
      ? "longform"
      : "shortform";

  const shelvesOut = ordered
    .map((g, idx) => {
      const isHeroShelf = idx === 0 && heroRow !== null;
      let pool = g.items.map((i) => i.row);
      if (isHeroShelf) pool = pool.filter((r) => r.id !== heroRow!.id);
      return {
        code: g.code,
        name: g.name,
        items: pool.slice(0, SHELF_PREVIEW).map(publicBadge),
        hasMore: pool.length > SHELF_PREVIEW,
      };
    })
    .filter((s) => s.items.length > 0);

  return {
    provider: {
      code: provider.code,
      name: provider.name,
      logoUrl: typeof provider.config?.logoUrl === "string" ? provider.config.logoUrl : null,
      contentType,
    },
    hero: heroRow ? publicBadge(heroRow) : null,
    shelves: shelvesOut,
  };
}

/** Maps a catalog row to a public item, redacting internal provider
 *  metadata/config (which may carry shelf internals or tokens). */
function publicBadge(r: LandingRow) {
  const { providerMetadata: _m, providerConfig: _c, ...publicFields } = withBadge(r);
  return publicFields;
}

export function buildCategoryResponse(
  provider: { code: string; name: string; config: Record<string, unknown> | null },
  category: { code: string; name: string },
  rows: LandingRow[],
  page: number,
  limit: number,
) {
  const contentType =
    typeof provider.config?.contentType === "string" && provider.config.contentType === "longform"
      ? "longform"
      : "shortform";
  return {
    provider: {
      code: provider.code,
      name: provider.name,
      logoUrl: typeof provider.config?.logoUrl === "string" ? provider.config.logoUrl : null,
      contentType,
    },
    category: { code: category.code, name: category.name },
    items: rows.slice(0, limit).map(publicBadge),
    page,
    limit,
    hasMore: rows.length > limit,
  };
}

// --- Landing + category routes ---

const LONGFORM_SELECT = {
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
  providerMetadata: dramaProviders.metadata,
  providerConfig: providers.config,
  providerDramaId: dramaProviders.providerDramaId,
} as const;

catalog.get("/providers/:code/landing", async (c) => {
  const code = c.req.param("code");
  const key = `landing:${code}`;
  const hit = cached(key);
  if (hit) return c.json(hit);

  const db = createDb(c.env.DATABASE_URL);
  const [provider] = await db
    .select({ id: providers.id, code: providers.code, name: providers.name, config: providers.config })
    .from(providers)
    .where(and(eq(providers.code, code), eq(providers.isEnabled, true)));
  if (!provider) return c.json({ error: "provider_not_found" }, 404);
  if (provider.config?.contentType !== "longform") return c.json({ error: "provider_not_found" }, 404);

  const rows = await db
    .select(LONGFORM_SELECT)
    .from(dramas)
    .innerJoin(dramaProviders, eq(dramas.id, dramaProviders.dramaId))
    .innerJoin(providers, eq(dramaProviders.providerId, providers.id))
    .where(
      and(
        eq(providers.id, provider.id),
        eq(dramas.isPublished, true),
        eq(dramas.visibility, "public"),
        eq(dramaProviders.isPrimary, true),
      ),
    )
    .orderBy(desc(dramas.popularityScore), desc(dramas.createdAt));

  const body = buildLanding(provider, rows as LandingRow[]);
  store(key, body);
  return c.json(body);
});

catalog.get("/providers/:code/categories/:categoryCode", async (c) => {
  const code = c.req.param("code");
  const categoryCode = c.req.param("categoryCode");
  const type = c.req.query("type");
  if (type !== undefined && type !== "movie" && type !== "series") {
    return c.json({ error: "invalid_type" }, 400);
  }
  const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 48) || 48));
  const key = `category:${code}:${categoryCode}:${type ?? "all"}:${page}:${limit}`;
  const hit = cached(key);
  if (hit) return c.json(hit);

  const db = createDb(c.env.DATABASE_URL);
  const [provider] = await db
    .select({ id: providers.id, code: providers.code, name: providers.name, config: providers.config })
    .from(providers)
    .where(and(eq(providers.code, code), eq(providers.isEnabled, true)));
  if (!provider) return c.json({ error: "provider_not_found" }, 404);
  if (provider.config?.contentType !== "longform") return c.json({ error: "provider_not_found" }, 404);

  const configShelves = Array.isArray(provider.config?.shelves)
    ? (provider.config!.shelves as { code?: unknown; name?: unknown }[])
    : [];
  const known = configShelves.find(
    (s) => typeof s?.code === "string" && s.code === categoryCode,
  );
  if (!known) return c.json({ error: "category_not_found" }, 404);
  const categoryName = typeof known.name === "string" ? known.name : categoryCode;

  const conditions = [
    eq(providers.id, provider.id),
    eq(dramas.isPublished, true),
    eq(dramas.visibility, "public"),
    eq(dramaProviders.isPrimary, true),
    sql`${dramaProviders.metadata}->'shelves' @> ${JSON.stringify([{ code: categoryCode }])}::jsonb`,
  ];
  if (type === "movie" || type === "series") {
    conditions.push(sql`${dramaProviders.metadata}->>'mediaType' = ${type}`);
  }

  const rows = await db
    .select(LONGFORM_SELECT)
    .from(dramas)
    .innerJoin(dramaProviders, eq(dramas.id, dramaProviders.dramaId))
    .innerJoin(providers, eq(dramaProviders.providerId, providers.id))
    .where(and(...conditions))
    .orderBy(desc(dramas.popularityScore), desc(dramas.createdAt))
    .limit(limit + 1)
    .offset((page - 1) * limit);

  const body = buildCategoryResponse(provider, { code: categoryCode, name: categoryName }, rows as LandingRow[], page, limit);
  store(key, body);
  return c.json(body);
});

catalog.get("/trending", async (c) => {
  const hit = cached("trending");
  if (hit) return c.json(hit);
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db
    .select({
      id: dramas.id,
      slug: dramas.slug,
      title: dramas.title,
      posterUrl: dramas.posterUrl,
      episodeCount: dramas.episodeCount,
      popularityScore: dramas.popularityScore,
      providerCode: providers.code,
      providerName: providers.name,
      providerMetadata: dramaProviders.metadata,
      providerConfig: providers.config,
    })
    .from(dramas)
    .innerJoin(dramaProviders, eq(dramas.id, dramaProviders.dramaId))
    .innerJoin(providers, eq(dramaProviders.providerId, providers.id))
    .where(and(eq(dramas.isPublished, true), eq(dramas.visibility, "public"), eq(dramaProviders.isPrimary, true)))
    .orderBy(desc(dramas.popularityScore))
    .limit(20);
  const body = { items: rows.map(withBadge) };
  store("trending", body);
  return c.json(body);
});

catalog.get("/new", async (c) => {
  const hit = cached("new");
  if (hit) return c.json(hit);
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db
    .select({
      id: dramas.id,
      slug: dramas.slug,
      title: dramas.title,
      posterUrl: dramas.posterUrl,
      episodeCount: dramas.episodeCount,
      createdAt: dramas.createdAt,
      providerCode: providers.code,
      providerName: providers.name,
      providerMetadata: dramaProviders.metadata,
      providerConfig: providers.config,
    })
    .from(dramas)
    .innerJoin(dramaProviders, eq(dramas.id, dramaProviders.dramaId))
    .innerJoin(providers, eq(dramaProviders.providerId, providers.id))
    .where(and(eq(dramas.isPublished, true), eq(dramas.visibility, "public"), eq(dramaProviders.isPrimary, true)))
    .orderBy(desc(dramas.createdAt))
    .limit(20);
  const body = { items: rows.map(withBadge) };
  store("new", body);
  return c.json(body);
});

catalog.get("/dramas/:slug", async (c) => {
  const slug = c.req.param("slug");
  const hit = cached("drama:" + slug);
  if (hit) return c.json(hit);
  const db = createDb(c.env.DATABASE_URL);
  const [row] = await db
    .select({
      drama: dramas,
      providerCode: providers.code,
      providerName: providers.name,
      providerMetadata: dramaProviders.metadata,
      providerConfig: providers.config,
    })
    .from(dramas)
    .innerJoin(dramaProviders, eq(dramas.id, dramaProviders.dramaId))
    .innerJoin(providers, eq(dramaProviders.providerId, providers.id))
    .where(and(eq(dramas.slug, slug), eq(dramaProviders.isPrimary, true)));
  if (!row) return c.json({ error: "not_found" }, 404);
  const eps = await db
    .select()
    .from(episodes)
    .where(eq(episodes.dramaId, row.drama.id))
    .orderBy(asc(episodes.seasonNumber), asc(episodes.episodeNumber));
  const kind = resolveContentKind({
    contentType: typeof row.providerMetadata?.contentType === "string" ? row.providerMetadata.contentType : null,
    mediaType: typeof row.providerMetadata?.mediaType === "string" ? row.providerMetadata.mediaType : null,
    providerContentType: typeof row.providerConfig?.contentType === "string" ? row.providerConfig.contentType : null,
    episodeCount: row.drama.episodeCount,
  });
  const body = {
    drama: {
      ...row.drama,
      contentType: kind.contentType,
      mediaType: kind.mediaType,
      provider: row.providerCode
        ? {
            code: row.providerCode,
            name: row.providerName ?? row.providerCode,
            contentType: kind.contentType,
          }
        : undefined,
    },
    episodes: eps,
  };
  store("drama:" + slug, body);
  return c.json(body);
});

catalog.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  const providerCode = (c.req.query("provider") ?? "").trim();
  const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 24) || 24));
  if (q.length < 2) return c.json({ items: [], page, limit, hasMore: false });

  const key = `search:${providerCode || "all"}:${q.toLowerCase()}:${page}:${limit}`;
  const hit = cached(key);
  if (hit) return c.json(hit);

  const db = createDb(c.env.DATABASE_URL);
  let selectedProvider: { id: string; code: string; name: string } | undefined;
  if (providerCode) {
    [selectedProvider] = await db
      .select({ id: providers.id, code: providers.code, name: providers.name })
      .from(providers)
      .where(and(eq(providers.code, providerCode), eq(providers.isEnabled, true)));
    if (!selectedProvider) return c.json({ error: "provider_not_found" }, 404);
  }

  const conditions = [
    sql`${dramas.title} ilike ${"%" + q + "%"}`,
    eq(dramas.isPublished, true),
    eq(dramas.visibility, "public"),
    eq(dramaProviders.isPrimary, true),
    eq(providers.isEnabled, true),
  ];
  if (selectedProvider) conditions.push(eq(providers.id, selectedProvider.id));

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
      providerCode: providers.code,
      providerName: providers.name,
      providerMetadata: dramaProviders.metadata,
      providerConfig: providers.config,
    })
    .from(dramas)
    .innerJoin(dramaProviders, eq(dramas.id, dramaProviders.dramaId))
    .innerJoin(providers, eq(dramaProviders.providerId, providers.id))
    .where(and(...conditions))
    .orderBy(desc(dramas.popularityScore), desc(dramas.createdAt))
    .limit(limit + 1)
    .offset((page - 1) * limit);

  const body = {
    items: rows.slice(0, limit).map(withBadge),
    page,
    limit,
    hasMore: rows.length > limit,
    ...(selectedProvider ? { provider: { code: selectedProvider.code, name: selectedProvider.name } } : {}),
  };
  store(key, body);
  return c.json(body);
});
