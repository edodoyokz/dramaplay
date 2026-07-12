import { describe, expect, it, vi } from "vitest";
import { WetvAdapter } from "../src/providers/sapimu/wetv";
import type { ProviderShelfSummary } from "@dramaplay/shared";

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

  it.each([
    { lang: "id" },
    { lang: "ID" },
    { lang: "id-ID" },
    { lang: "id_ID" },
    { name: "Indonesia" },
    { name: "Bahasa Indonesia" },
  ])("selects Indonesian caption $lang$name", async (caption) => {
    const adapter = new WetvAdapter("https://captain.sapimu.au", "tok");
    // @ts-expect-error test double
    adapter.get = vi.fn().mockResolvedValue({
      data: {
        playUrl: "https://cdn/play.m3u8",
        subtitles: [{ ...caption, url: "https://cdn/id.vtt" }],
      },
    });
    expect(await adapter.resolveStream("cid:vid")).toMatchObject({
      subtitleUrl: "https://cdn/id.vtt",
      subtitleLanguage: "id",
    });
  });

  it("skips an empty Indonesian caption for a later valid one", async () => {
    const adapter = new WetvAdapter("https://captain.sapimu.au", "tok");
    // @ts-expect-error test double
    adapter.get = vi.fn().mockResolvedValue({
      data: {
        playUrl: "https://cdn/play.m3u8",
        subtitles: [
          { lang: "id", url: "" },
          { lang: "id", url: "https://cdn/id.vtt" },
        ],
      },
    });
    expect(await adapter.resolveStream("cid:vid")).toMatchObject({
      subtitleUrl: "https://cdn/id.vtt",
      subtitleLanguage: "id",
    });
  });

  it.each([
    [{ lang: "en", url: "https://cdn/en.vtt" }],
    [{ lang: "xx", url: "https://cdn/first.vtt" }],
    [
      { lang: "en", url: "https://cdn/en.vtt" },
      { lang: "id", url: "" },
    ],
  ])("omits unrecognized or unusable captions %#", async (...subtitles) => {
    const adapter = new WetvAdapter("https://captain.sapimu.au", "tok");
    // @ts-expect-error test double
    adapter.get = vi.fn().mockResolvedValue({
      data: { playUrl: "https://cdn/play.m3u8", subtitles },
    });
    expect(await adapter.resolveStream("cid:vid")).toEqual({
      streamUrl: "https://cdn/play.m3u8",
      streamType: "m3u8",
    });
  });

  it("uses Indonesian locale for every endpoint", async () => {
    const adapter = new WetvAdapter("https://captain.sapimu.au", "tok");
    const get = vi.fn()
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce(feed)
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce(detail)
      .mockResolvedValueOnce(episodes)
      .mockResolvedValueOnce(play);
    // @ts-expect-error test double
    adapter.get = get;
    await adapter.fetchForYou();
    await adapter.search("film");
    await adapter.fetchDetail("cid");
    await adapter.fetchEpisodes("cid");
    await adapter.resolveStream("cid:vid");
    for (const [url] of get.mock.calls) {
      expect(url).toContain("lang=id");
      expect(url).toContain("country=ID");
    }
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
        seasonNumber: 1,
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

describe("WetvAdapter.fetchShelves", () => {
  const channels = {
    code: 0,
    data: [
      { id: "10483", name: "Featured Free Content" },
      { id: "1001", name: "Untukmu" },
      { id: "10234", name: "Latest" },
    ],
  };
  const feedFeatured = {
    code: 0,
    data: [
      {
        type: "module",
        name: "Hot",
        items: [
          { cid: "a1", title: "Alpha", cover: "https://x/a.jpg" },
          { cid: "b2", title: "Beta", cover: "https://x/b.jpg" },
        ],
      },
    ],
  };
  const feedUntukmu = {
    code: 0,
    data: [
      {
        type: "module",
        name: "Untukmu",
        items: [
          { cid: "b2", title: "Beta", cover: "https://x/b.jpg" },
          { cid: "c3", title: "Gamma", cover: "https://x/c.jpg" },
        ],
      },
    ],
  };

  it("returns one shelf per non-empty channel in upstream order with item positions", async () => {
    const adapter = new WetvAdapter("https://captain.sapimu.au", "tok");
    const get = vi
      .fn()
      .mockResolvedValueOnce(channels)
      .mockResolvedValueOnce(feedFeatured)
      .mockResolvedValueOnce(feedUntukmu)
      .mockRejectedValueOnce(new Error("503"));
    // @ts-expect-error test double
    adapter.get = get;

    const shelves = await adapter.fetchShelves!();
    expect(get.mock.calls[0][0]).toContain("/wetv/api/channels");
    expect(shelves).toHaveLength(2);
    expect(shelves[0]).toMatchObject({ code: "10483", name: "Featured Free Content" });
    expect(shelves[1]).toMatchObject({ code: "1001", name: "Untukmu" });
    // positions preserve upstream feed order
    expect(shelves[0].items[0]).toMatchObject({
      providerDramaId: "a1",
      shelves: [{ code: "10483", name: "Featured Free Content", position: 0 }],
    });
    expect(shelves[0].items[1]).toMatchObject({
      providerDramaId: "b2",
      shelves: [{ code: "10483", name: "Featured Free Content", position: 1 }],
    });
    expect(shelves[1].items[0]).toMatchObject({
      providerDramaId: "b2", shelves: [{ code: "1001", position: 0 }] });
    expect(shelves[1].items[1]).toMatchObject({
      providerDramaId: "c3", shelves: [{ code: "1001", position: 1 }] });
  });

  it("keeps every channel membership for a title that appears in multiple channels", async () => {
    const adapter = new WetvAdapter("https://captain.sapimu.au", "tok");
    const get = vi
      .fn()
      .mockResolvedValueOnce(channels)
      .mockResolvedValueOnce(feedFeatured)
      .mockResolvedValueOnce(feedUntukmu)
      .mockRejectedValueOnce(new Error("503"));
    // @ts-expect-error test double
    adapter.get = get;

    const shelves = (await adapter.fetchShelves!()) as ProviderShelfSummary[];
    // b2 appears in both shelves with distinct positions; the adapter does not
    // cross-dedupe shelves (sync merges memberships later).
    const featuredB = shelves[0].items.find((i) => i.providerDramaId === "b2");
    const untukmuB = shelves[1].items.find((i) => i.providerDramaId === "b2");
    expect(featuredB?.shelves?.[0].position).toBe(1);
    expect(untukmuB?.shelves?.[0].position).toBe(0);
  });

  it("skips a channel whose feed fails without discarding successful channels", async () => {
    const adapter = new WetvAdapter("https://captain.sapimu.au", "tok");
    const get = vi
      .fn()
      .mockResolvedValueOnce(channels)
      .mockResolvedValueOnce(feedFeatured)
      .mockResolvedValueOnce(feedUntukmu)
      .mockRejectedValueOnce(new Error("503 maintenance"));
    // @ts-expect-error test double
    adapter.get = get;

    const shelves = await adapter.fetchShelves!();
    expect(shelves.map((s) => s.code)).toEqual(["10483", "1001"]);
  });

  it("falls back to the default channel when channels list is empty", async () => {
    const adapter = new WetvAdapter("https://captain.sapimu.au", "tok");
    const get = vi
      .fn()
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce(feedUntukmu);
    // @ts-expect-error test double
    adapter.get = get;

    const shelves = await adapter.fetchShelves!();
    expect(shelves).toHaveLength(1);
    expect(shelves[0]).toMatchObject({ code: "1001", name: "Untukmu" });
  });
});
