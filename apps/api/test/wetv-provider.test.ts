import { describe, expect, it, vi } from "vitest";
import { WetvAdapter } from "../src/providers/sapimu/wetv";

const feed = {
  code: 0,
  data: [
    {
      type: "module",
      name: "Hot",
      items: [
        {
          cid: "le1lbx64do19qal",
          title: "Dendam Seribu Bunga",
          subtitle: "Takdir",
          cover: "https://vcover-vt-pic.wetvinfo.com/cover.jpg",
        },
      ],
    },
  ],
};

const detail = {
  code: 0,
  data: {
    cid: "wu7vz4vgfi8ugan",
    title: "Dunia Roh 2",
    description: "synopsis",
    year: "2023",
    areaName: "Daratan/Tiongkok",
    posterHz: "https://vcover-hz-pic.wetvinfo.com/hz.jpg",
    posterVt: "https://vcover-vt-pic.wetvinfo.com/vt.jpg",
    mainGenres: ["Fantasi"],
    totalEpisodes: 161,
    category: 10994,
  },
};

const episodes = {
  code: 0,
  data: [
    {
      vid: "j00467e65u4",
      episode: "01",
      title: "EP01",
      duration: 1285,
      isTrailer: false,
      cover: "https://newpic.wetvinfo.com/ep1.jpg",
    },
    {
      vid: "trailer1",
      episode: "00",
      title: "Trailer",
      duration: 60,
      isTrailer: true,
      cover: "https://newpic.wetvinfo.com/tr.jpg",
    },
  ],
};

const play = {
  code: 0,
  data: {
    playUrl: "https://cdn.example/play.m3u8",
    formats: [{ name: "hd", playUrl: "https://cdn.example/hd.m3u8" }],
    subtitles: [{ lang: "ID", name: "Bahasa Indonesia", url: "https://cdn.example/id.vtt" }],
    vid: "j00467e65u4",
    duration: "1285.00",
  },
};

describe("WetvAdapter", () => {
  it("merges all channel feeds for forYou catalog coverage", async () => {
    const adapter = new WetvAdapter("https://captain.sapimu.au", "tok");
    const get = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "1001" }, { id: "10234" }] })
      .mockResolvedValueOnce(feed)
      .mockResolvedValueOnce({
        data: [
          {
            items: [{ cid: "film1", title: "Film Satu", cover: "https://x/a.jpg" }],
          },
        ],
      });
    // @ts-expect-error test double
    adapter.get = get;
    const items = await adapter.fetchForYou();
    expect(items.items.map((x) => x.providerDramaId).sort()).toEqual(["film1", "le1lbx64do19qal"]);
    expect(get.mock.calls[0][0]).toContain("/wetv/api/channels");
  });

  it("maps feed/detail/episodes/play into long-form provider shapes", async () => {
    const adapter = new WetvAdapter("https://captain.sapimu.au", "tok");
    const get = vi
      .fn()
      .mockResolvedValueOnce(feed)
      .mockResolvedValueOnce(detail)
      .mockResolvedValueOnce(episodes)
      .mockResolvedValueOnce(play);
    // @ts-expect-error test double
    adapter.get = get;

    const items = await adapter.fetchLatest();
    expect(items[0]).toMatchObject({
      providerDramaId: "le1lbx64do19qal",
      title: "Dendam Seribu Bunga",
      posterUrl: "https://vcover-vt-pic.wetvinfo.com/cover.jpg",
      contentType: "longform",
    });

    const d = await adapter.fetchDetail("wu7vz4vgfi8ugan");
    expect(d).toMatchObject({
      providerDramaId: "wu7vz4vgfi8ugan",
      title: "Dunia Roh 2",
      posterUrl: "https://vcover-vt-pic.wetvinfo.com/vt.jpg",
      backdropUrl: "https://vcover-hz-pic.wetvinfo.com/hz.jpg",
      synopsis: "synopsis",
      contentType: "longform",
      mediaType: "series",
      episodeCount: 161,
    });

    const eps = await adapter.fetchEpisodes("wu7vz4vgfi8ugan");
    expect(eps).toEqual([
      {
        providerEpisodeId: "wu7vz4vgfi8ugan:j00467e65u4",
        episodeNumber: 1,
        title: "EP01",
        thumbnailUrl: "https://newpic.wetvinfo.com/ep1.jpg",
        durationSeconds: 1285,
      },
    ]);

    const stream = await adapter.resolveStream("wu7vz4vgfi8ugan:j00467e65u4");
    expect(stream).toMatchObject({
      streamUrl: "https://cdn.example/play.m3u8",
      streamType: "m3u8",
      subtitleUrl: "https://cdn.example/id.vtt",
      subtitleLanguage: "id",
    });
  });
});
