import { describe, expect, it } from "vitest";
import {
  filterLongformItems,
  isLongformProviderCode,
  partitionLongformItems,
  pickFeaturedItems,
  resolveItemMediaType,
} from "../src/lib/longform-provider";

describe("longform-provider helpers", () => {
  it("detects wetv/moviebox codes", () => {
    expect(isLongformProviderCode("wetv")).toBe(true);
    expect(isLongformProviderCode("MovieBox")).toBe(true);
    expect(isLongformProviderCode("shortmax")).toBe(false);
  });

  it("infers media type from episode count when marker missing", () => {
    expect(resolveItemMediaType({ mediaType: "movie" })).toBe("movie");
    expect(resolveItemMediaType({ mediaType: "series" })).toBe("series");
    expect(resolveItemMediaType({ episodeCount: 1 })).toBe("movie");
    expect(resolveItemMediaType({ episodeCount: 12 })).toBe("series");
  });

  it("partitions and filters film vs serial", () => {
    const items = [
      { id: "1", mediaType: "movie" as const, episodeCount: 1 },
      { id: "2", mediaType: "series" as const, episodeCount: 10 },
      { id: "3", episodeCount: 24 },
    ];
    const { movies, series } = partitionLongformItems(items);
    expect(movies.map((x) => x.id)).toEqual(["1"]);
    expect(series.map((x) => x.id)).toEqual(["2", "3"]);
    expect(filterLongformItems(items, "movie").map((x) => x.id)).toEqual(["1"]);
    expect(filterLongformItems(items, "series").map((x) => x.id)).toEqual(["2", "3"]);
    expect(filterLongformItems(items, "all")).toHaveLength(3);
  });

  it("picks featured posters preferring year then episode depth", () => {
    const items = [
      { id: "a", posterUrl: "x", year: 2020, episodeCount: 1 },
      { id: "b", posterUrl: "y", year: 2024, episodeCount: 8 },
      { id: "c", year: 2025, episodeCount: 2 },
    ];
    expect(pickFeaturedItems(items, 2).map((x) => x.id)).toEqual(["b", "a"]);
  });
});
