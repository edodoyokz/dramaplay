import { describe, expect, it, vi } from "vitest";
import { findStreamUrl, streamTypeFromUrl, firstArray, unique } from "../src/providers/sapimu/base";

const feedRaw = {
  code: 200, message: "success",
  data: { items: [{ type: "recommend", items: [
    { key: "uIVZZq9wl0", title: "Rasa Cinta", cover: "https://x/c.jpg", desc: "A romance.", tag: ["Romance"], content_tags: ["Romance"] },
    { key: "QZ6ztksGsi", title: "Misi Cinta", cover: "https://x/m.jpg", desc: "An action.", tag: [], content_tags: ["Action"] },
  ]}] },
};

function toSummary(row: any) {
  const tag = Array.isArray(row.tag) ? row.tag.map(String) : [];
  const ctags = Array.isArray(row.content_tags) ? row.content_tags.map(String) : [];
  return {
    providerDramaId: String(row.key ?? ""),
    title: String(row.title ?? "Untitled"),
    posterUrl: typeof row.cover === "string" && row.cover ? row.cover : undefined,
    genres: tag.length ? tag : ctags.length ? ctags : undefined,
  };
}

describe("dramawave adapter mapping", () => {
  it("firstArray extracts nested .data.items[*].items for module-wrapped feeds", () => {
    const result = firstArray(feedRaw);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ key: "uIVZZq9wl0", title: "Rasa Cinta" });
    expect(result[1].key).toBe("QZ6ztksGsi");
  });

  it("toSummary maps providerDramaId from key", () => {
    const items = firstArray(feedRaw);
    const summary = toSummary(items[0]);
    expect(summary.providerDramaId).toBe("uIVZZq9wl0");
    expect(summary.title).toBe("Rasa Cinta");
    expect(summary.posterUrl).toBe("https://x/c.jpg");
  });

  it("toSummary maps genres from tag array", () => {
    const [item1, item2] = firstArray(feedRaw);
    expect(toSummary(item1).genres).toEqual(["Romance"]);
    expect(toSummary(item2).genres).toEqual(["Action"]);
  });

  it("unique deduplicates by providerDramaId", () => {
    const items = firstArray(feedRaw).map(toSummary);
    const deduped = unique(items, (x) => x.providerDramaId);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].providerDramaId).toBe("uIVZZq9wl0");
  });

  it("play data: findStreamUrl extracts video_720", () => {
    const playRaw = { code: 200, data: { video: { video_720: "https://stream.mydramawave.com/720/main.m3u8" } } };
    const url = findStreamUrl(playRaw);
    expect(url).toBe("https://stream.mydramawave.com/720/main.m3u8");
    expect(streamTypeFromUrl(url!)).toBe("m3u8");
  });

  it("firstArray handles flat search result (no module wrapper)", () => {
    const searchRaw = { code: 200, data: { items: [{ key: "abc123", title: "Love Story" }] } };
    const result = firstArray(searchRaw);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ key: "abc123" });
  });
});

// ─── Adapter instantiation smoke test ─────────────────────────────────────
import { SapimuDramaWaveAdapter } from "../src/providers/sapimu/dramawave";

describe("SapimuDramaWaveAdapter instantiation", () => {
  it("creates adapter with correct code", () => {
    const a = new SapimuDramaWaveAdapter("dramawave", "https://captain.sapimu.au", "tok123");
    expect(a.code).toBe("dramawave");
  });

  it("has all required interface methods", () => {
    const a = new SapimuDramaWaveAdapter("dramawave", "https://captain.sapimu.au", "tok123") as any;
    expect(typeof a.fetchForYou).toBe("function");
    expect(typeof a.fetchTrending).toBe("function");
    expect(typeof a.fetchLatest).toBe("function");
    expect(typeof a.fetchVip).toBe("function");
    expect(typeof a.search).toBe("function");
    expect(typeof a.fetchDetail).toBe("function");
    expect(typeof a.fetchEpisodes).toBe("function");
    expect(typeof a.resolveStream).toBe("function");
  });
});
