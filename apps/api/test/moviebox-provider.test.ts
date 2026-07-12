import { describe, expect, it, vi } from "vitest";
import { MovieBoxAdapter } from "../src/providers/sapimu/moviebox";

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
    extCaptions: [],
  },
};

describe("MovieBoxAdapter", () => {
  it("maps home/detail/stream into long-form provider shapes", async () => {
    const adapter = new MovieBoxAdapter("https://captain.sapimu.au", "tok");
    const getJson = vi
      .fn()
      .mockResolvedValueOnce(home)
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
      episodeCount: 2,
    });

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
    });
  });
});
