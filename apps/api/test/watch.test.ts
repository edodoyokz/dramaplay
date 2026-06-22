import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock all external deps so we test only the caching/VIP control flow.
const drama = { id: "d1", slug: "test", title: "Test", posterUrl: null } as any;
const freeEp = { id: "e1", dramaId: "d1", episodeNumber: 1, accessType: "free" } as any;
const vipEp = { id: "e2", dramaId: "d1", episodeNumber: 2, accessType: "vip" } as any;

let selectCalls = 0;
function fakeDb() {
  // chainable stub: every terminal returns rows based on call order
  const make = (rows: any[]) => {
    const chain: any = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => Promise.resolve(rows),
      then: (r: any) => Promise.resolve(rows).then(r),
    };
    return chain;
  };
  return {
    select: (..._a: any[]) => {
      selectCalls++;
      // 1: drama lookup, 2: episode lookup, then streamResponse: providers/next/subs
      return make(_selectRows());
    },
  };
}

let _epToReturn = freeEp;
function _selectRows() {
  // crude router by call index within a request
  const n = selectCalls;
  if (n === 1) return [drama];
  if (n === 2) return [_epToReturn];
  if (n === 3) return [{ providerEpisodeId: "px" }]; // primary
  if (n === 4) return [{ episodeNumber: 2 }]; // next
  return [{ url: "https://sub" }]; // subtitle
}

vi.mock("@dramaplay/db", () => ({
  createDb: () => fakeDb(),
  dramas: {}, episodes: {}, subtitles: {}, episodeProviders: {},
}));
vi.mock("../src/providers/registry", () => ({
  buildProviders: () => ({ p: { resolveStream: async () => ({ streamUrl: "https://stream", streamType: "mp4" }) } }),
}));
const isUserVip = vi.fn(async () => true);
vi.mock("../src/lib/entitlements", () => ({ isUserVip: (...a: any[]) => isUserVip(...a) }));
const getUserId = vi.fn(async () => "u1");
vi.mock("../src/middleware/auth", () => ({ getUserId: (...a: any[]) => getUserId(...a) }));

import { watch } from "../src/routes/watch";

const env = { DATABASE_URL: "x", PROVIDER_BASE_URL: "http://x" } as any;

beforeEach(() => {
  selectCalls = 0;
  isUserVip.mockClear();
  getUserId.mockClear();
});

describe("watch caching + VIP control", () => {
  it("serves free episode, then second request hits cache (no extra db selects)", async () => {
    _epToReturn = freeEp;
    selectCalls = 0;
    const r1 = await watch.request("/test/1", {}, env);
    expect(r1.status).toBe(200);
    const after = selectCalls;
    expect(after).toBeGreaterThan(0);

    selectCalls = 0; // reset counter; a cache hit must not run any select
    const r2 = await watch.request("/test/1", {}, env);
    expect(r2.status).toBe(200);
    expect(selectCalls).toBe(0); // <- proves cache hit
  });

  it("VIP episode always re-checks entitlement, never cached", async () => {
    _epToReturn = vipEp;
    isUserVip.mockResolvedValue(true);
    selectCalls = 0;
    const r1 = await watch.request("/test/2", { headers: { Authorization: "Bearer t" } }, env);
    expect(r1.status).toBe(200);
    expect(isUserVip).toHaveBeenCalledTimes(1);

    selectCalls = 0;
    const r2 = await watch.request("/test/2", { headers: { Authorization: "Bearer t" } }, env);
    expect(r2.status).toBe(200);
    expect(isUserVip).toHaveBeenCalledTimes(2); // re-checked, not served from cache
  });

  it("VIP without valid entitlement is denied", async () => {
    _epToReturn = vipEp;
    isUserVip.mockResolvedValue(false);
    selectCalls = 0;
    const r = await watch.request("/test/2", { headers: { Authorization: "Bearer t" } }, env);
    expect(r.status).toBe(403);
  });
});
