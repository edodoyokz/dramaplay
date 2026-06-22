import { Hono } from "hono";
import { createDb, dramas, episodes, dramaProviders, providers } from "@dramaplay/db";
import { eq, desc, asc, sql, and } from "drizzle-orm";
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

function withBadge<T extends { providerCode: string | null; providerName: string | null }>(r: T) {
  return {
    ...r,
    provider: r.providerCode
      ? { code: r.providerCode, name: r.providerName ?? r.providerCode }
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

    shelves.push({
      code: p.code,
      name: p.name,
      logoUrl: typeof p.config?.logoUrl === "string" ? p.config.logoUrl : null,
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
    .orderBy(episodes.episodeNumber);
  const body = {
    drama: {
      ...row.drama,
      provider: row.providerCode
        ? { code: row.providerCode, name: row.providerName ?? row.providerCode }
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
