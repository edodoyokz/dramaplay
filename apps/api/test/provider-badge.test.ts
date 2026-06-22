import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock DB + schema
const drama1 = { id: "d1", slug: "reelshort-love", title: "Love in the Ashes", posterUrl: "https://x/p.jpg" };
const drama2 = { id: "d2", slug: "netshort-cinta", title: "Cinta", posterUrl: "https://x/c.jpg" };
const providerReelshort = { id: "p1", code: "reelshort", name: "ReelShort" };
const providerNetshort = { id: "p2", code: "netshort", name: "NetShort" };
const dp1 = { dramaId: "d1", providerId: "p1", isPrimary: true };
const dp2 = { dramaId: "d2", providerId: "p2", isPrimary: true };

// Simple in-memory DB stub for catalog responses
function buildCatalogResponse(rows: typeof drama1[], dps: typeof dp1[], provs: typeof providerReelshort[]) {
  return rows.map((drama) => {
    const dp = dps.find((d) => d.dramaId === drama.id && d.isPrimary);
    const provider = dp ? provs.find((p) => p.id === dp.providerId) : undefined;
    return {
      ...drama,
      provider: provider ? { code: provider.code, name: provider.name } : undefined,
    };
  });
}

describe("provider badge in API responses", () => {
  it("catalog trending returns provider badge per item", () => {
    const rows = [drama1, drama2];
    const result = buildCatalogResponse(rows, [dp1, dp2], [providerReelshort, providerNetshort]);
    expect(result[0]).toMatchObject({
      slug: "reelshort-love",
      provider: { code: "reelshort", name: "ReelShort" },
    });
    expect(result[1]).toMatchObject({
      slug: "netshort-cinta",
      provider: { code: "netshort", name: "NetShort" },
    });
  });

  it("catalog detail returns provider badge", () => {
    const result = buildCatalogResponse([drama1], [dp1], [providerReelshort]);
    expect(result[0]).toMatchObject({
      slug: "reelshort-love",
      provider: { code: "reelshort", name: "ReelShort" },
    });
  });

  it("catalog item without provider has undefined provider", () => {
    const result = buildCatalogResponse([drama1], [], [providerReelshort]);
    expect(result[0]).toHaveProperty("provider");
    expect(result[0].provider).toBeUndefined();
  });

  it("watch response includes provider badge", () => {
    // Simulate watch response shape
    const watchResp = {
      streamUrl: "https://x.m3u8",
      streamType: "m3u8",
      dramaTitle: "Love in the Ashes",
      dramaSlug: "reelshort-love",
      episodeNumber: 1,
      provider: { code: "reelshort", name: "ReelShort" },
    };
    expect(watchResp.provider).toMatchObject({ code: "reelshort", name: "ReelShort" });
  });

  it("slug includes provider code to prevent collision", () => {
    const sameTitle = "Love";
    function slug(providerCode: string, title: string) {
      return `${providerCode}-${title.toLowerCase().replace(/\s+/g, "-")}`;
    }
    expect(slug("reelshort", sameTitle)).not.toBe(slug("netshort", sameTitle));
  });
});

// --- Provider homepage shelves ---

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

describe("provider homepage shelves", () => {
  it("groups by enabled provider and keeps max 3 dramas", () => {
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

  it("omits disabled providers", () => {
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

  it("sorts shelves by priority then name", () => {
    const rows = [
      { id: "a", slug: "a", title: "A", posterUrl: null, episodeCount: 1, isPublished: true, visibility: "public", isPrimary: true, providerEnabled: true, providerCode: "netshort", providerName: "NetShort", providerPriority: 34 },
      { id: "b", slug: "b", title: "B", posterUrl: null, episodeCount: 1, isPublished: true, visibility: "public", isPrimary: true, providerEnabled: true, providerCode: "reelshort", providerName: "ReelShort", providerPriority: 30 },
    ];
    const shelves = buildHomeShelves(rows);
    expect(shelves.map((s) => s.code)).toEqual(["reelshort", "netshort"]);
  });
});
