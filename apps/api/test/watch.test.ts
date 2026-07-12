import { describe, it, expect, beforeEach, vi } from "vitest";

const drama = { id: "d1", slug: "test", title: "Test", posterUrl: null } as any;
const freeEp = {
  id: "e1",
  dramaId: "d1",
  seasonNumber: 1,
  episodeNumber: 1,
  accessType: "free",
} as any;
const s2e1 = {
  id: "e2",
  dramaId: "d1",
  seasonNumber: 2,
  episodeNumber: 1,
  accessType: "free",
} as any;
const vipEp = {
  id: "e3",
  dramaId: "d1",
  seasonNumber: 1,
  episodeNumber: 2,
  accessType: "vip",
} as any;
const provider = { id: "p1", code: "reelshort", name: "ReelShort", providerDramaId: "pd1" } as any;

let _epToReturn: typeof freeEp = freeEp;
let _nextEp: { seasonNumber: number; episodeNumber: number } | null = {
  seasonNumber: 1,
  episodeNumber: 2,
};
let _resolveStreamResult:
  | {
      streamUrl: string;
      streamType: "mp4" | "m3u8";
      subtitleUrl?: string;
      subtitleLanguage?: string;
    }
  | null = { streamUrl: "https://stream", streamType: "mp4" };
let _isVip = true;
let _state = {
  dramaCalled: false,
  epCalled: false,
  providerCalled: false,
  epProvCalled: false,
  nextEpCalled: false,
  subCalled: false,
};

function chain(rows: any[]) {
  return {
    from: () => chain(rows),
    innerJoin: () => chain(rows),
    where: () => chain(rows),
    orderBy: () => chain(rows),
    limit: () => Promise.resolve(rows),
    then: (r: any) => Promise.resolve(rows).then(r),
  };
}

function makeDb() {
  return {
    select: () => {
      if (!_state.dramaCalled) {
        _state.dramaCalled = true;
        return chain([drama]);
      }
      if (!_state.epCalled) {
        _state.epCalled = true;
        return chain([_epToReturn]);
      }
      if (!_state.providerCalled) {
        _state.providerCalled = true;
        return chain([provider]);
      }
      if (!_state.epProvCalled) {
        _state.epProvCalled = true;
        return chain([{ providerEpisodeId: "px" }]);
      }
      if (!_state.nextEpCalled) {
        _state.nextEpCalled = true;
        return chain(_nextEp ? [_nextEp] : []);
      }
      _state.subCalled = true;
      return chain([]);
    },
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({
          catch: () => Promise.resolve(),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          catch: () => Promise.resolve(),
        }),
      }),
    }),
  };
}

const { isUserVip, getUserId, resolveStream, buildProviders } = vi.hoisted(() => {
  const isUserVip = vi.fn(() => Promise.resolve(_isVip));
  const getUserId = vi.fn(() => Promise.resolve("u1"));
  const resolveStream = vi.fn(() => Promise.resolve(_resolveStreamResult));
  const buildProviders = vi.fn(() => ({ reelshort: { resolveStream } }));
  return { isUserVip, getUserId, resolveStream, buildProviders };
});

vi.mock("@dramaplay/db", () => ({
  createDb: () => makeDb(),
  dramas: {},
  episodes: {},
  subtitles: {},
  episodeProviders: {},
  dramaProviders: {},
  providers: {},
}));
vi.mock("../src/lib/entitlements", () => ({ isUserVip: (..._a: any[]) => isUserVip() }));
vi.mock("../src/middleware/auth", () => ({ getUserId: (..._a: any[]) => getUserId() }));
vi.mock("../src/providers/registry", () => ({ buildProviders }));
vi.mock("../src/providers/sapimu/core/media", () => ({
  subtitleFormatFromUrl: () => "vtt",
  isRenderableSubtitle: (url: string) => /\.vtt(\?|$|#)/i.test(url) || /\.srt(\?|$|#)/i.test(url),
}));

import { watch } from "../src/routes/watch";

const env = { DATABASE_URL: "x", PROVIDER_BASE_URL: "http://x" } as any;

function reset() {
  _state = {
    dramaCalled: false,
    epCalled: false,
    providerCalled: false,
    epProvCalled: false,
    nextEpCalled: false,
    subCalled: false,
  };
}

beforeEach(() => {
  reset();
  _epToReturn = freeEp;
  _nextEp = { seasonNumber: 1, episodeNumber: 2 };
  _isVip = true;
  _resolveStreamResult = { streamUrl: "https://stream", streamType: "mp4" };
  isUserVip.mockClear();
  getUserId.mockClear();
  resolveStream.mockClear();
});

describe("watch season identity + VIP control", () => {
  it("serves free episode, second request hits cache", async () => {
    drama.slug = "cache-hit";
    const r1 = await watch.request("/cache-hit/1/1", {}, env);
    expect(r1.status).toBe(200);
    const body1 = await r1.json();
    expect(body1).toHaveProperty("streamUrl");
    expect(body1).toMatchObject({ seasonNumber: 1, episodeNumber: 1 });

    const r2 = await watch.request("/cache-hit/1/1", {}, env);
    expect(r2.status).toBe(200);
    expect(body1).toEqual(await r2.json());
  });

  it("routes S1E1 and S2E1 independently", async () => {
    drama.slug = "seasons";
    _epToReturn = freeEp;
    const s1 = await watch.request("/seasons/1/1", {}, env);
    expect(s1.status).toBe(200);
    expect(await s1.json()).toMatchObject({ seasonNumber: 1, episodeNumber: 1 });

    reset();
    _epToReturn = s2e1;
    const s2 = await watch.request("/seasons/2/1", {}, env);
    expect(s2.status).toBe(200);
    expect(await s2.json()).toMatchObject({ seasonNumber: 2, episodeNumber: 1 });
  });

  it("orders next episode across season boundaries", async () => {
    drama.slug = "next-ep";
    _epToReturn = { ...freeEp, episodeNumber: 2 };
    _nextEp = { seasonNumber: 2, episodeNumber: 1 };
    const response = await watch.request("/next-ep/1/2", {}, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      nextEpisode: { seasonNumber: 2, episodeNumber: 1 },
    });
  });

  it("rejects malformed identities", async () => {
    expect((await watch.request("/bad/nope/1", {}, env)).status).toBe(400);
    expect((await watch.request("/bad/-1/1", {}, env)).status).toBe(400);
    expect((await watch.request("/bad/1/0", {}, env)).status).toBe(400);
  });

  it("does not invent Indonesian subtitle metadata", async () => {
    drama.slug = "no-sub";
    _resolveStreamResult = {
      streamUrl: "https://stream",
      streamType: "mp4",
    };
    const body = await (await watch.request("/no-sub/1/1", {}, env)).json();
    expect(body).not.toHaveProperty("subtitleUrl");
    expect(body).not.toHaveProperty("subtitleLanguage");
  });

  it("does not persist or serve non-Indonesian source subtitles", async () => {
    drama.slug = "en-sub";
    _resolveStreamResult = {
      streamUrl: "https://stream",
      streamType: "mp4",
      subtitleUrl: "https://sub/en.vtt",
      subtitleLanguage: "en",
    };
    const body = await (await watch.request("/en-sub/1/1", {}, env)).json();
    expect(body).not.toHaveProperty("subtitleUrl");
    expect(body).not.toHaveProperty("subtitleLanguage");
  });

  it("returns stream_unavailable when the provider has no usable stream", async () => {
    drama.slug = "unavailable";
    _resolveStreamResult = null;
    const response = await watch.request("/unavailable/1/1", {}, env);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "stream_unavailable" });
  });

  it("VIP episode always re-checks entitlement, never cached", async () => {
    drama.slug = "vip-check";
    _epToReturn = vipEp;
    _isVip = true;
    const r1 = await watch.request("/vip-check/1/2", { headers: { Authorization: "Bearer t" } }, env);
    expect(r1.status).toBe(200);
    expect(isUserVip).toHaveBeenCalledTimes(1);

    reset();
    const r2 = await watch.request("/vip-check/1/2", { headers: { Authorization: "Bearer t" } }, env);
    expect(r2.status).toBe(200);
    expect(isUserVip).toHaveBeenCalledTimes(2);
  });

  it("VIP without auth is denied", async () => {
    drama.slug = "vip-deny";
    _epToReturn = vipEp;
    reset();
    const r = await watch.request("/vip-deny/1/2", {}, env);
    expect(r.status).toBe(403);
  });

  it("successful watch response includes provider badge", async () => {
    drama.slug = "badge";
    const r = await watch.request("/badge/1/1", {}, env);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("provider");
    expect(body.provider).toMatchObject({ code: "reelshort", name: "ReelShort" });
  });

  it("keeps season-1 compatibility route", async () => {
    drama.slug = "compat";
    const r = await watch.request("/compat/1", {}, env);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ seasonNumber: 1, episodeNumber: 1 });
  });
});
