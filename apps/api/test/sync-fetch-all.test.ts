import { describe, expect, it } from "vitest";
import { fetchAllProviderSummaries, warmPosterUrls } from "../src/sync/sync";

const item = (providerDramaId: string, title = providerDramaId) => ({ providerDramaId, title });

describe("fetchAllProviderSummaries", () => {
  it("merges all provider shelves, not only latest", async () => {
    const items = await fetchAllProviderSummaries({
      fetchForYou: async () => ({ items: [item("for-you"), item("same", "old")] }),
      fetchTrending: async () => [item("trending")],
      fetchLatest: async () => [item("latest"), item("same", "new")],
      fetchVip: async () => [item("vip")],
    } as any);

    expect(items.map((x) => x.providerDramaId).sort()).toEqual([
      "for-you",
      "latest",
      "same",
      "trending",
      "vip",
    ]);
    expect(items.find((x) => x.providerDramaId === "same")?.title).toBe("new");
  });

  it("includes optional search keywords", async () => {
    const items = await fetchAllProviderSummaries({
      fetchForYou: async () => ({ items: [] }),
      fetchTrending: async () => [],
      fetchLatest: async () => [],
      fetchVip: async () => [],
      search: async (q: string) => [item(`search-${q}`)],
    } as any, ["sistem"]);

    expect(items.map((x) => x.providerDramaId)).toEqual(["search-sistem"]);
  });

  it("warms each unique signed poster through the durable image proxy", async () => {
    const calls: string[] = [];
    const result = await warmPosterUrls(
      "https://dramaplay.my.id",
      [{ posterUrl: "https://p16.tiktokcdn.com/a.jpg?x=1" }, { posterUrl: "https://p16.tiktokcdn.com/a.jpg?x=1" }, {}],
      async (url) => {
        calls.push(String(url));
        return new Response(null, { status: 200 });
      },
    );

    expect(calls).toEqual([
      "https://dramaplay.my.id/img?u=https%3A%2F%2Fp16.tiktokcdn.com%2Fa.jpg%3Fx%3D1",
    ]);
    expect(result).toEqual({ warmed: 1, failed: 0 });
  });
});
