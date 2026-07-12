import { describe, expect, it } from "vitest";
import { providerPreflight } from "../src/providers/preflight";

const item = { providerDramaId: "d1", title: "Drama 1" };
const ep = { providerEpisodeId: "d1:e1", seasonNumber: 1, episodeNumber: 1 };

describe("providerPreflight", () => {
  it("checks list, detail, episodes, and stream using one sample", async () => {
    const calls: string[] = [];
    const result = await providerPreflight("x", {
      fetchLatest: async () => (calls.push("list"), [item]),
      fetchForYou: async () => ({ items: [] }),
      fetchTrending: async () => [],
      fetchVip: async () => [],
      fetchDetail: async (id: string) => (calls.push(`detail:${id}`), { ...item }),
      fetchEpisodes: async (id: string) => (calls.push(`episodes:${id}`), [ep]),
      resolveStream: async (id: string) => (calls.push(`stream:${id}`), { streamUrl: "https://x/v.m3u8", streamType: "m3u8" }),
    } as any);

    expect(result.ok).toBe(true);
    expect(result.sampleTitle).toBe("Drama 1");
    expect(calls).toEqual(["list", "detail:d1", "episodes:d1", "stream:d1:e1"]);
  });
});
