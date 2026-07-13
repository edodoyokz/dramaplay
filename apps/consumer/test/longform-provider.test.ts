import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { StaticRouter } from "react-router-dom/server";
import {
  categoryApiPath,
  categoryPath,
  categoryUrl,
  filterLongformItems,
  isLongformProviderCode,
  landingApiPath,
  partitionLongformItems,
  pickFeaturedItems,
  resolveItemMediaType,
} from "../src/lib/longform-provider";
import { LongformCard } from "../src/components/LongformCard";

describe("longform-provider helpers", () => {
  it("detects wetv/moviebox codes", () => {
    expect(isLongformProviderCode("wetv")).toBe(true);
    expect(isLongformProviderCode("MovieBox")).toBe(true);
    expect(isLongformProviderCode("shortmax")).toBe(false);
    expect(isLongformProviderCode("")).toBe(false);
    expect(isLongformProviderCode(undefined)).toBe(false);
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

describe("category path + url helpers", () => {
  it("encodes provider and category into the route", () => {
    expect(categoryPath("wetv", "10483")).toBe("/provider/wetv/category/10483");
    expect(categoryPath("moviebox", "1")).toBe("/provider/moviebox/category/1");
  });

  it("categoryUrl includes type query only for movie|series, never all", () => {
    expect(categoryUrl("wetv", "10483", "all")).toBe("/provider/wetv/category/10483");
    expect(categoryUrl("wetv", "10483", "movie")).toBe("/provider/wetv/category/10483?type=movie");
    expect(categoryUrl("wetv", "10483", "series")).toBe("/provider/wetv/category/10483?type=series");
  });

  it("invalid filter falls back to all (no query)", () => {
    expect(categoryUrl("wetv", "x", "anime" as never)).toBe("/provider/wetv/category/x");
  });

  it("landingApiPath targets the landing endpoint", () => {
    expect(landingApiPath("wetv")).toBe("/catalog/providers/wetv/landing");
    expect(landingApiPath("moviebox")).toBe("/catalog/providers/moviebox/landing");
  });

  it("categoryApiPath encodes page and only movie|series type", () => {
    expect(categoryApiPath("wetv", "10483", 1)).toBe("/catalog/providers/wetv/categories/10483?page=1&limit=48");
    expect(categoryApiPath("moviebox", "1", 2, "series")).toContain("type=series");
    expect(categoryApiPath("moviebox", "1", 2, "series")).toContain("page=2");
    expect(categoryApiPath("moviebox", "1", 2, "all")).not.toContain("type=");
  });
});

describe("LongformCard routing + metadata", () => {
  const base = {
    id: "1",
    slug: "alpha",
    title: "Alpha",
    posterUrl: "https://x/a.jpg",
    country: "CN",
    year: 2024,
    rating: 0,
    episodeCount: 10,
    contentType: "longform" as const,
    mediaType: "series" as const,
  };

  it("links a series to detail", () => {
    const html = renderToStaticMarkup(
      React.createElement(StaticRouter, null, React.createElement(LongformCard, { drama: base })),
    );
    expect(html).toContain('href="/title/alpha"');
  });

  it("links a movie to detail by default", () => {
    const movie = { ...base, slug: "mov", mediaType: "movie" as const, episodeCount: 1 };
    const html = renderToStaticMarkup(
      React.createElement(StaticRouter, null, React.createElement(LongformCard, { drama: movie })),
    );
    expect(html).toContain('href="/title/mov"');
  });

  it("links a movie directly to watch only when a verified watch target is supplied", () => {
    const movie = { ...base, slug: "mov", mediaType: "movie" as const, episodeCount: 1 };
    expect(
      renderToStaticMarkup(
        React.createElement(StaticRouter, null, React.createElement(LongformCard, { drama: movie })),
      ),
    ).toContain('href="/title/mov"');
    expect(
      renderToStaticMarkup(
        React.createElement(StaticRouter, null, React.createElement(LongformCard, { drama: movie, watchSeason: 1, watchEpisode: 1 }))),
    ).toContain("/title/mov/watch/1/1");
  });

  it("omits zero rating from the card", () => {
    const html = renderToStaticMarkup(
      React.createElement(StaticRouter, null, React.createElement(LongformCard, { drama: { ...base, rating: 0 } })),
    );
    expect(html).not.toMatch(/★|⭐|rating/i);
  });

  it("omits missing year and genre (no stray separators)", () => {
    const html = renderToStaticMarkup(
      React.createElement(StaticRouter, null, React.createElement(LongformCard, {
        drama: { ...base, year: null, genres: null, country: null },
      })),
    );
    expect(html).not.toContain(" • ");
  });

  it("renders a poster fallback when posterUrl is missing", () => {
    const html = renderToStaticMarkup(
      React.createElement(StaticRouter, null, React.createElement(LongformCard, { drama: { ...base, posterUrl: null } })),
    );
    expect(html).toContain("No Image");
  });
});
