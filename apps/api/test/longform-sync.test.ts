import { describe, expect, it } from "vitest";
import { buildProviderMeta, fetchAllProviderSummaries } from "../src/sync/sync";
import type { ProviderDramaSummary, ProviderShelfMembership } from "@dramaplay/shared";

const shelf = (code: string, name: string, position: number): ProviderShelfMembership => ({
  code,
  name,
  position,
});

describe("buildProviderMeta", () => {
  it("persists shelf membership for a title present in two shelves", () => {
    const item = {
      providerDramaId: "s1",
      title: "Alpha",
      contentType: "longform",
      mediaType: "series",
      shelves: [shelf("popular", "Popular", 0), shelf("top100", "TOP100", 4)],
    } as ProviderDramaSummary;

    expect(buildProviderMeta(item)).toEqual({
      contentType: "longform",
      mediaType: "series",
      shelves: [shelf("popular", "Popular", 0), shelf("top100", "TOP100", 4)],
    });
  });

  it("is additive: short-form items keep the existing two-key metadata", () => {
    const item = {
      providerDramaId: "x1",
      title: "Short",
      contentType: "shortform",
      mediaType: "vertical",
    } as ProviderDramaSummary;

    expect(buildProviderMeta(item)).toEqual({
      contentType: "shortform",
      mediaType: "vertical",
    });
    expect("shelves" in buildProviderMeta(item)).toBe(false);
  });

  it("replaces stale shelf membership on re-sync rather than appending", () => {
    const base = {
      providerDramaId: "s1",
      title: "Alpha",
      contentType: "longform",
      mediaType: "series",
    } as ProviderDramaSummary;

    const oldMeta = buildProviderMeta({ ...base, shelves: [shelf("popular", "Popular", 0)] });
    const newMeta = buildProviderMeta({ ...base, shelves: [shelf("top100", "TOP100", 2)] });

    // onConflictDoUpdate replaces the whole metadata column, so newMeta holds
    // only the current shelf — not the union with the previous sync.
    expect(newMeta).toEqual({
      contentType: "longform",
      mediaType: "series",
      shelves: [shelf("top100", "TOP100", 2)],
    });
    expect((newMeta as { shelves?: ProviderShelfMembership[] }).shelves).not.toContainEqual(
      (oldMeta as { shelves: ProviderShelfMembership[] }).shelves[0],
    );
  });
});

const item = (id: string, shelves?: ProviderShelfMembership[]): ProviderDramaSummary =>
  ({ providerDramaId: id, title: id, shelves } as ProviderDramaSummary);

describe("fetchAllProviderSummaries shelf merge", () => {
  it("merges memberships for a title appearing in two upstream shelves", async () => {
    const items = await fetchAllProviderSummaries({
      fetchShelves: async () => [
        { code: "popular", name: "Popular", items: [item("s1", [shelf("popular", "Popular", 0)])] },
        { code: "top100", name: "TOP100", items: [item("s1", [shelf("top100", "TOP100", 4)])] },
      ],
      fetchForYou: async () => ({ items: [] }),
      fetchTrending: async () => [],
      fetchLatest: async () => [],
      fetchVip: async () => [],
    } as never);

    const s1 = items.find((x) => x.providerDramaId === "s1");
    expect(s1?.shelves).toEqual([shelf("popular", "Popular", 0), shelf("top100", "TOP100", 4)]);
  });

  it("keeps shelves from fetchShelves when forYou returns the same id without shelves", async () => {
    const items = await fetchAllProviderSummaries({
      fetchShelves: async () => [
        { code: "1", name: "Featured", items: [item("s1", [shelf("1", "Featured", 0)])] },
      ],
      fetchForYou: async () => ({ items: [item("s1")] }),
      fetchTrending: async () => [],
      fetchLatest: async () => [],
      fetchVip: async () => [],
    } as never);

    const s1 = items.find((x) => x.providerDramaId === "s1");
    expect(s1?.shelves).toEqual([shelf("1", "Featured", 0)]);
  });

  it("dedupes shelf memberships by code across sources", async () => {
    const items = await fetchAllProviderSummaries({
      fetchShelves: async () => [
        { code: "1", name: "Featured", items: [item("s1", [shelf("1", "Featured", 0)])] },
      ],
      fetchForYou: async () => ({ items: [item("s1", [shelf("1", "Featured", 9)])] }),
      fetchTrending: async () => [],
      fetchLatest: async () => [],
      fetchVip: async () => [],
    } as never);

    const s1 = items.find((x) => x.providerDramaId === "s1");
    // First-seen position wins; duplicate code from forYou is ignored.
    expect(s1?.shelves).toEqual([shelf("1", "Featured", 0)]);
  });

  it("short-form adapters without fetchShelves stay unchanged", async () => {
    const items = await fetchAllProviderSummaries({
      fetchForYou: async () => ({ items: [item("a"), item("b")] }),
      fetchTrending: async () => [],
      fetchLatest: async () => [],
      fetchVip: async () => [],
    } as never);

    expect(items.map((x) => x.providerDramaId).sort()).toEqual(["a", "b"]);
    expect(items.every((x) => !x.shelves)).toBe(true);
  });
});
