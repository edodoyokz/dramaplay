import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildLanding,
  buildCategoryResponse,
  groupShelves,
  orderShelves,
  parseShelfMemberships,
  pickHero,
} from "../src/routes/catalog";
import type { ProviderShelfMembership } from "@dramaplay/shared";

const shelf = (code: string, name: string, position: number): ProviderShelfMembership => ({
  code,
  name,
  position,
});

interface Row {
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

function mkRow(
  id: string,
  shelves: ProviderShelfMembership[],
  mediaType: "movie" | "series" = "series",
  extra: Partial<Row> = {},
): Row {
  return {
    id,
    slug: `slug-${id}`,
    title: `Title ${id}`,
    posterUrl: `https://x/${id}.jpg`,
    backdropUrl: `https://x/${id}-bg.jpg`,
    country: "CN",
    year: 2024,
    genres: ["Action"],
    rating: 8.5,
    episodeCount: 10,
    popularityScore: 100,
    providerCode: "wetv",
    providerName: "WeTV",
    providerMetadata: { contentType: "longform", mediaType, shelves },
    providerConfig: { contentType: "longform", logoUrl: "/logos/wetv.png" },
    providerDramaId: `pd-${id}`,
    ...extra,
  };
}

const wetvConfig = {
  contentType: "longform",
  logoUrl: "/logos/wetv.png",
  shelves: [
    { code: "10483", name: "Featured Free Content" },
    { code: "1001", name: "Untukmu" },
    { code: "10234", name: "Latest" },
  ],
};

describe("parseShelfMemberships", () => {
  it("reads ordered memberships from provider metadata", () => {
    expect(parseShelfMemberships({ shelves: [shelf("a", "A", 0), shelf("b", "B", 1)] })).toEqual([
      shelf("a", "A", 0),
      shelf("b", "B", 1),
    ]);
  });
  it("returns empty for missing or malformed shelves", () => {
    expect(parseShelfMemberships(null)).toEqual([]);
    expect(parseShelfMemberships({})).toEqual([]);
    expect(parseShelfMemberships({ shelves: "nope" })).toEqual([]);
    expect(parseShelfMemberships({ shelves: [{ code: 1 }] })).toEqual([]);
  });
});

describe("groupShelves", () => {
  it("groups rows by shelf code and sorts items by upstream position", () => {
    const rows = [
      mkRow("b", [shelf("1", "Featured", 1)]),
      mkRow("a", [shelf("1", "Featured", 0)]),
      mkRow("c", [shelf("1", "Featured", 2), shelf("2", "Untukmu", 0)]),
    ];
    const groups = groupShelves(rows);
    expect(groups.map((g) => g.code)).toEqual(["1", "2"]);
    expect(groups[0].items.map((i) => i.row.id)).toEqual(["a", "b", "c"]);
    expect(groups[1].items.map((i) => i.row.id)).toEqual(["c"]);
  });
});

describe("pickHero", () => {
  it("prefers WeTV Featured Free Content over Untukmu", () => {
    const groups = groupShelves([
      mkRow("a", [shelf("1001", "Untukmu", 0)]),
      mkRow("b", [shelf("10483", "Featured Free Content", 0)]),
    ]);
    expect(pickHero(groups, "wetv")?.name).toBe("Featured Free Content");
  });
  it("falls back to Untukmu when Featured Free Content is absent", () => {
    const groups = groupShelves([mkRow("a", [shelf("1001", "Untukmu", 0)])]);
    expect(pickHero(groups, "wetv")?.name).toBe("Untukmu");
  });
  it("prefers MovieBox Popular then TOP100", () => {
    const groups = groupShelves([
      mkRow("a", [shelf("2", "TOP100", 0)]),
      mkRow("b", [shelf("1", "Popular", 0)]),
    ]);
    expect(pickHero(groups, "moviebox")?.name).toBe("Popular");
  });
  it("returns null when no preferred shelf is present", () => {
    const groups = groupShelves([mkRow("a", [shelf("9", "Random", 0)])]);
    expect(pickHero(groups, "wetv")).toBeNull();
  });
});

describe("orderShelves", () => {
  it("places the hero shelf first, then config order", () => {
    const rows = [
      mkRow("a", [shelf("10234", "Latest", 0)]),
      mkRow("b", [shelf("1001", "Untukmu", 0)]),
      mkRow("c", [shelf("10483", "Featured Free Content", 0)]),
    ];
    const groups = groupShelves(rows);
    const ordered = orderShelves(groups, wetvConfig, "wetv");
    expect(ordered.map((g) => g.name)).toEqual([
      "Featured Free Content",
      "Untukmu",
      "Latest",
    ]);
  });
  it("falls back to first-seen order when config.shelves is absent", () => {
    const rows = [
      mkRow("a", [shelf("1001", "Untukmu", 0)]),
      mkRow("b", [shelf("10483", "Featured Free Content", 0)]),
    ];
    const groups = groupShelves(rows);
    const ordered = orderShelves(groups, null, "wetv");
    // Hero (Featured) first, then first-seen (Untukmu).
    expect(ordered.map((g) => g.name)).toEqual(["Featured Free Content", "Untukmu"]);
  });
});

describe("buildLanding", () => {
  it("returns the first item of the preferred shelf as hero", () => {
    const rows = [
      mkRow("hero", [shelf("10483", "Featured Free Content", 0)]),
      mkRow("x", [shelf("10483", "Featured Free Content", 1)]),
      mkRow("y", [shelf("1001", "Untukmu", 0)]),
    ];
    const body = buildLanding({ code: "wetv", name: "WeTV", config: wetvConfig }, rows);
    expect(body.hero).toMatchObject({ id: "hero", title: "Title hero" });
    expect(body.provider).toMatchObject({ code: "wetv", contentType: "longform" });
  });

  it("omits the hero from only the first shelf preview, keeps it in others", () => {
    const rows = [
      mkRow("hero", [shelf("10483", "Featured Free Content", 0), shelf("1001", "Untukmu", 3)]),
      mkRow("x", [shelf("10483", "Featured Free Content", 1)]),
    ];
    const body = buildLanding({ code: "wetv", name: "WeTV", config: wetvConfig }, rows);
    const featured = body.shelves.find((s) => s.name === "Featured Free Content")!;
    const untukmu = body.shelves.find((s) => s.name === "Untukmu")!;
    expect(featured.items.map((i) => i.id)).not.toContain("hero");
    expect(untukmu.items.map((i) => i.id)).toContain("hero");
  });

  it("orders shelves hero-first then config order", () => {
    const rows = [
      mkRow("a", [shelf("10234", "Latest", 0)]),
      mkRow("b", [shelf("1001", "Untukmu", 0)]),
      mkRow("c", [shelf("10483", "Featured Free Content", 0)]),
      mkRow("d", [shelf("10483", "Featured Free Content", 1)]),
    ];
    const body = buildLanding({ code: "wetv", name: "WeTV", config: wetvConfig }, rows);
    expect(body.shelves.map((s) => s.name)).toEqual([
      "Featured Free Content",
      "Untukmu",
      "Latest",
    ]);
  });

  it("reports hasMore when a shelf exceeds the preview limit", () => {
    const featured: ProviderShelfMembership[] = Array.from({ length: 12 }, (_, i) =>
      shelf("10483", "Featured Free Content", i),
    );
    const rows = Array.from({ length: 12 }, (_, i) => mkRow(`r${i}`, [featured[i]]));
    const body = buildLanding({ code: "wetv", name: "WeTV", config: wetvConfig }, rows);
    const featuredShelf = body.shelves.find((s) => s.name === "Featured Free Content")!;
    // 12 items - 1 hero = 11 pool; preview caps at 10.
    expect(featuredShelf.items).toHaveLength(10);
    expect(featuredShelf.hasMore).toBe(true);
  });

  it("omits empty shelves and returns no hero when none match", () => {
    const rows = [mkRow("a", [shelf("999", "Random", 0)])];
    const body = buildLanding({ code: "wetv", name: "WeTV", config: wetvConfig }, rows);
    expect(body.hero).toBeNull();
    expect(body.shelves).toHaveLength(1);
  });

  it("exposes no token or raw provider metadata in the response", () => {
    const rows = [
      mkRow("hero", [shelf("10483", "Featured Free Content", 0)], "series", {
        providerConfig: { contentType: "longform", logoUrl: "/logos/wetv.png", secret: "LEAK" },
        providerMetadata: { contentType: "longform", mediaType: "series", shelves: [shelf("10483", "Featured Free Content", 0)] },
      }),
    ];
    const body = buildLanding({ code: "wetv", name: "WeTV", config: rows[0].providerConfig }, rows);
    const json = JSON.stringify(body);
    expect(json).not.toContain("secret");
    expect(json).not.toContain("LEAK");
    expect(json).not.toContain("providerMetadata");
    expect(json).not.toContain("providerConfig");
  });

  it("hero null when all shelves empty", () => {
    const body = buildLanding({ code: "wetv", name: "WeTV", config: wetvConfig }, []);
    expect(body.hero).toBeNull();
    expect(body.shelves).toEqual([]);
  });
});

describe("buildCategoryResponse", () => {
  it("slices to limit and reports hasMore from overflow row", () => {
    const rows = Array.from({ length: 25 }, (_, i) => mkRow(`r${i}`, [shelf("1", "Popular", i)]));
    const body = buildCategoryResponse(
      { code: "moviebox", name: "MovieBox", config: { contentType: "longform", logoUrl: "/logos/moviebox.png" } },
      { code: "1", name: "Popular" },
      rows,
      1,
      24,
    );
    expect(body.items).toHaveLength(24);
    expect(body.hasMore).toBe(true);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(24);
    expect(body.category).toEqual({ code: "1", name: "Popular" });
  });

  it("hasMore false when rows fit within limit", () => {
    const rows = [mkRow("a", [shelf("1", "Popular", 0)])];
    const body = buildCategoryResponse(
      { code: "moviebox", name: "MovieBox", config: null },
      { code: "1", name: "Popular" },
      rows,
      1,
      48,
    );
    expect(body.items).toHaveLength(1);
    expect(body.hasMore).toBe(false);
  });
});

// --- HTTP route 404/400 cases with a mocked DB ---

function chain(rows: unknown[]) {
  return {
    from: () => chain(rows),
    innerJoin: () => chain(rows),
    where: () => chain(rows),
    orderBy: () => chain(rows),
    limit: () => Promise.resolve(rows),
    offset: () => Promise.resolve(rows),
    then: (r: any) => Promise.resolve(rows).then(r),
  };
}

let _providerRows: unknown[] = [];
function makeDb() {
  return {
    select: () => chain(_providerRows),
  };
}

vi.mock("@dramaplay/db", () => ({
  createDb: () => makeDb(),
  dramas: {},
  episodes: {},
  dramaProviders: {},
  providers: {},
}));

import { catalog } from "../src/routes/catalog";

const env = { DATABASE_URL: "x" } as never;

beforeEach(() => {
  _providerRows = [];
  // bust in-isolate cache between tests
  (catalog as any).routes?.forEach?.(() => {});
});

describe("catalog routes — validation", () => {
  it("GET /providers/:code/landing returns 404 for unknown provider", async () => {
    _providerRows = [];
    const r = await catalog.request("/providers/ghost/landing", {}, env);
    expect(r.status).toBe(404);
  });

  it("GET /providers/:code/landing returns 404 for short-form provider", async () => {
    _providerRows = [{ id: "p1", code: "dramabox", name: "DramaBox", config: { contentType: "shortform" } }];
    const r = await catalog.request("/providers/dramabox/landing", {}, env);
    expect(r.status).toBe(404);
  });

  it("GET /providers/:code/categories/:cat returns 400 for invalid type", async () => {
    _providerRows = [{ id: "p1", code: "wetv", name: "WeTV", config: { contentType: "longform", shelves: [{ code: "10483", name: "Featured" }] } }];
    const r = await catalog.request("/providers/wetv/categories/10483?type=anime", {}, env);
    expect(r.status).toBe(400);
  });

  it("GET /providers/:code/categories/:cat returns 404 for unknown category", async () => {
    _providerRows = [{ id: "p1", code: "wetv", name: "WeTV", config: { contentType: "longform", shelves: [{ code: "10483", name: "Featured" }] } }];
    const r = await catalog.request("/providers/wetv/categories/nope", {}, env);
    expect(r.status).toBe(404);
  });
});
