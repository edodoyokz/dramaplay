import { describe, expect, it, vi } from "vitest";
import { MovieBoxAdapter, pickMovieBoxCaption } from "../src/providers/sapimu/moviebox";
import type { ProviderShelfSummary } from "@dramaplay/shared";

const home = {
  code: 0,
  message: "ok",
  data: [
    {
      subjectId: "7850278583678682192",
      title: "Avatar: The Last Airbender",
      cover: { url: "https://pbcdn.aoneroom.com/image/avatar.jpg" },
      releaseDate: "2024-02-22",
      genre: "Action, Adventure",
    },
  ],
};

const detailSeries = {
  code: 0,
  message: "ok",
  data: {
    subjectId: "7850278583678682192",
    title: "Avatar: The Last Airbender",
    description: "synopsis",
    releaseDate: "2024-02-22",
    duration: "",
    genre: "Action, Adventure",
    cover: { url: "https://pbcdn.aoneroom.com/image/avatar.jpg" },
    countryName: "USA",
    language: "English",
    episodes: [
      { episode: 1, se: 1, title: "S1E1", duration: 3600 },
      { episode: 2, se: 1, title: "S1E2", duration: 3500 },
      { episode: 1, se: 2, title: "S2E1", duration: 3400 },
    ],
  },
};

const detailMovie = {
  code: 0,
  message: "ok",
  data: {
    subjectId: "2248839832283796416",
    title: "Love",
    description: "movie synopsis",
    releaseDate: "2018-05-01",
    duration: "",
    genre: "drama",
    cover: { url: "https://pbcdn.aoneroom.com/image/love.jpg" },
    countryName: "Nigeria",
    language: "Yoruba",
    episodes: [{ episode: 0, se: 0, title: "Love", duration: 4572 }],
  },
};

const stream = {
  code: 0,
  message: "ok",
  data: {
    title: "Love",
    resourceLink: "https://macdn.hakunaymatata.com/resource/love.mp4",
    resolution: 360,
    duration: 4572,
    extCaptions: [
      { lan: "en", lanName: "English", url: "https://cacdn.hakunaymatata.com/subtitle/en.srt" },
      { lan: "in_id", lanName: "Indonesia", url: "https://cacdn.hakunaymatata.com/subtitle/id.srt" },
    ],
  },
};

describe("MovieBoxAdapter", () => {
  it("uses Indonesian locale for search", async () => {
    const adapter = new MovieBoxAdapter("https://captain.sapimu.au", "tok");
    const getJson = vi.fn().mockResolvedValue({ data: [] });
    // @ts-expect-error test double
    adapter.getJson = getJson;
    await adapter.search("film");
    expect(getJson.mock.calls[0][0]).toContain("lang=id");
  });

  it.each([
    [[{ lan: "in_id", url: "https://cdn/id.srt" }], { url: "https://cdn/id.srt", language: "id" }],
    [[{ lan: "id-ID", url: "https://cdn/id.srt" }], { url: "https://cdn/id.srt", language: "id" }],
    [[{ lanName: "Indonesia", url: "https://cdn/id.srt" }], { url: "https://cdn/id.srt", language: "id" }],
  ])("selects recognized Indonesian caption %#", (captions, expected) => {
    expect(pickMovieBoxCaption(captions)).toEqual(expected);
  });

  it.each([
    [{ lan: "en", url: "https://cdn/en.srt" }],
    [{ lan: "xx", url: "https://cdn/first.srt" }],
  ])("rejects non-Indonesian caption %#", (caption) => {
    expect(pickMovieBoxCaption([caption])).toBeUndefined();
  });

  it("skips an empty Indonesian caption before a valid one", () => {
    expect(
      pickMovieBoxCaption([
        { lan: "id", url: "" },
        { lan: "in_id", url: "https://cdn/valid-id.srt" },
      ]),
    ).toEqual({ url: "https://cdn/valid-id.srt", language: "id" });
  });

  it("omits subtitle properties when no Indonesian caption exists", async () => {
    const adapter = new MovieBoxAdapter("https://captain.sapimu.au", "tok");
    // @ts-expect-error test double
    adapter.getJson = vi.fn().mockResolvedValue({
      data: {
        resourceLink: "https://cdn/movie.mp4",
        extCaptions: [{ lan: "en", url: "https://cdn/en.srt" }],
      },
    });

    const source = await adapter.resolveStream("movie:0:0");
    expect(source).not.toHaveProperty("subtitleUrl");
    expect(source).not.toHaveProperty("subtitleLanguage");
  });

  it("maps home/detail/stream into long-form provider shapes", async () => {
    const adapter = new MovieBoxAdapter("https://captain.sapimu.au", "tok");
    const getJson = vi
      .fn()
      .mockResolvedValueOnce(home)
      .mockResolvedValueOnce(detailSeries)
      .mockResolvedValueOnce(detailSeries)
      .mockResolvedValueOnce(detailMovie)
      .mockResolvedValueOnce(detailMovie)
      .mockResolvedValueOnce(stream);
    // @ts-expect-error test double
    adapter.getJson = getJson;

    const items = await adapter.fetchLatest();
    expect(items[0]).toMatchObject({
      providerDramaId: "7850278583678682192",
      title: "Avatar: The Last Airbender",
      posterUrl: "https://pbcdn.aoneroom.com/image/avatar.jpg",
      contentType: "longform",
    });

    const series = await adapter.fetchDetail("7850278583678682192");
    expect(series).toMatchObject({
      contentType: "longform",
      mediaType: "series",
      episodeCount: 3,
    });

    const seriesEps = await adapter.fetchEpisodes("7850278583678682192");
    expect(seriesEps).toEqual([
      expect.objectContaining({
        providerEpisodeId: "7850278583678682192:1:1",
        seasonNumber: 1,
        episodeNumber: 1,
      }),
      expect.objectContaining({
        providerEpisodeId: "7850278583678682192:1:2",
        seasonNumber: 1,
        episodeNumber: 2,
      }),
      expect.objectContaining({
        providerEpisodeId: "7850278583678682192:2:1",
        seasonNumber: 2,
        episodeNumber: 1,
      }),
    ]);

    const movie = await adapter.fetchDetail("2248839832283796416");
    expect(movie).toMatchObject({
      contentType: "longform",
      mediaType: "movie",
      episodeCount: 1,
    });

    const eps = await adapter.fetchEpisodes("2248839832283796416");
    expect(eps).toEqual([
      {
        providerEpisodeId: "2248839832283796416:0:0",
        seasonNumber: 0,
        episodeNumber: 1,
        title: "Love",
        durationSeconds: 4572,
      },
    ]);

    const src = await adapter.resolveStream("2248839832283796416:0:0");
    expect(src).toMatchObject({
      streamUrl: "https://macdn.hakunaymatata.com/resource/love.mp4",
      streamType: "mp4",
      quality: "360",
      subtitleUrl: "https://cacdn.hakunaymatata.com/subtitle/id.srt",
      subtitleLanguage: "id",
    });
  });
});

describe("MovieBoxAdapter.fetchShelves", () => {
  const mkItem = (id: string, title: string) => ({
    subjectId: id,
    title,
    cover: { url: `https://pbcdn.aoneroom.com/image/${id}.jpg` },
    releaseDate: "2024-01-01",
    genre: "Action, Adventure",
  });
  const categories = {
    code: 0,
    message: "ok",
    data: [
      { name: "Popular", type: "1" },
      { name: "TOP100", type: "2" },
      { name: "Action", type: "3" },
      { name: "EmptyCat", type: "6" },
      { name: "DupOfPopular", type: "1" },
      { name: "Horror", type: "7" },
    ],
  };
  const catContent = (rows: ReturnType<typeof mkItem>[]) => ({ code: 0, message: "ok", data: rows });

  // Queue order after ranking: Popular, TOP100, Action, EmptyCat, DupOfPopular(skip), Horror
  const contentResponses = [
    catContent([mkItem("s1", "Alpha"), mkItem("s2", "Beta")]), // Popular
    catContent([mkItem("s2", "Beta"), mkItem("s3", "Gamma")]),   // TOP100
    catContent([mkItem("s4", "Delta")]),                          // Action
    catContent([]),                                               // EmptyCat
    catContent([mkItem("s5", "Epsilon")]),                        // Horror
  ];

  function shelfAdapter() {
    const adapter = new MovieBoxAdapter("https://captain.sapimu.au", "tok");
    const getJson = vi
      .fn()
      .mockResolvedValueOnce(categories)
      .mockResolvedValueOnce(contentResponses[0])
      .mockResolvedValueOnce(contentResponses[1])
      .mockResolvedValueOnce(contentResponses[2])
      .mockResolvedValueOnce(contentResponses[3])
      .mockResolvedValueOnce(contentResponses[4]);
    // @ts-expect-error test double
    adapter.getJson = getJson;
    return { adapter, getJson };
  }

  it("selects Popular and TOP100 first, then upstream order, skipping empty and duplicate types", async () => {
    const { adapter, getJson } = shelfAdapter();
    const shelves = await adapter.fetchShelves!();
    expect(shelves.map((s) => s.name)).toEqual(["Popular", "TOP100", "Action", "Horror"]);
    // categories endpoint first
    expect(getJson.mock.calls[0][0]).toContain("/moviebox/api/tabs/categories");
    // duplicate type (DupOfPopular type 1) never fetched — only 5 content calls
    expect(getJson.mock.calls).toHaveLength(6);
  });

  it("tags items with category membership and upstream feed position", async () => {
    const { adapter } = shelfAdapter();
    const shelves = await adapter.fetchShelves!();
    expect(shelves[0].items[0]).toMatchObject({
      providerDramaId: "s1",
      shelves: [{ code: "1", name: "Popular", position: 0 }],
    });
    expect(shelves[0].items[1]).toMatchObject({
      providerDramaId: "s2",
      shelves: [{ code: "1", name: "Popular", position: 1 }],
    });
    expect(shelves[1].items[0]).toMatchObject({
      providerDramaId: "s2",
      shelves: [{ code: "2", name: "TOP100", position: 0 }],
    });
  });

  it("retains every category membership for a title in multiple categories", async () => {
    const { adapter } = shelfAdapter();
    const shelves = (await adapter.fetchShelves!()) as ProviderShelfSummary[];
    const popularS2 = shelves[0].items.find((i) => i.providerDramaId === "s2");
    const top100S2 = shelves[1].items.find((i) => i.providerDramaId === "s2");
    expect(popularS2?.shelves?.[0]).toMatchObject({ code: "1", position: 1 });
    expect(top100S2?.shelves?.[0]).toMatchObject({ code: "2", position: 0 });
  });

  it("uses Indonesian locale and Bearer auth on category endpoints", async () => {
    const { adapter, getJson } = shelfAdapter();
    await adapter.fetchShelves!();
    const [catPath, catOpts] = getJson.mock.calls[0];
    expect(catPath).toContain("lang=id");
    expect((catOpts as { headers?: Record<string, string> }).headers?.Authorization).toBe("Bearer tok");
    const [contentPath] = getJson.mock.calls[1];
    expect(contentPath).toContain("/moviebox/api/tabs/category-content");
    expect(contentPath).toContain("type=1");
    expect(contentPath).toContain("lang=id");
  });

  it("caps at eight non-empty categories", async () => {
    const adapter = new MovieBoxAdapter("https://captain.sapimu.au", "tok");
    const manyCats = {
      code: 0,
      message: "ok",
      data: [
        { name: "Popular", type: "1" },
        { name: "TOP100", type: "2" },
        ...Array.from({ length: 9 }, (_, i) => ({ name: `Cat${i + 3}`, type: String(i + 3) })),
      ],
    };
    const getJson = vi.fn();
    getJson.mockResolvedValueOnce(manyCats);
    // every category non-empty
    for (let i = 0; i < 11; i++) getJson.mockResolvedValueOnce(catContent([mkItem(`x${i}`, `T${i}`)]));
    // @ts-expect-error test double
    adapter.getJson = getJson;
    const shelves = await adapter.fetchShelves!();
    expect(shelves).toHaveLength(8);
    // 1 categories + 8 content fetches; the 9th content endpoint never called
    expect(getJson.mock.calls).toHaveLength(9);
  });
});
