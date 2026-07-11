import { describe, expect, it } from "vitest";
import {
  firstArray,
  findStreamUrl,
  streamTypeFromUrl,
  unique,
} from "../src/providers/sapimu/base";
import { dramawave } from "../src/providers/sapimu/providers";
import type { SapimuCtx } from "../src/providers/sapimu/core/types";

// Dramawave feed: module-wrapped { data: { items: [{ type, items: [drama] }] } }
const feedRaw = {
  code: 200,
  data: {
    items: [
      {
        type: "recommend",
        items: [
          { id: "uIVZZq9wl0", name: "Rasa Cinta", cover: "https://x/c.jpg", content_tags: ["Romance"] },
          { id: "QZ6ztksGsi", name: "Misi Cinta", cover: "https://x/m.jpg", content_tags: ["Action"] },
        ],
      },
    ],
  },
};

describe("firstArray (dramawave module-wrapped feed)", () => {
  it("flattens data.items[*].items into drama rows", () => {
    const items = firstArray(feedRaw);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: "uIVZZq9wl0", name: "Rasa Cinta" });
    expect(items[1].id).toBe("QZ6ztksGsi");
  });

  it("handles flat arrays (search result)", () => {
    expect(firstArray({ data: { lists: [{ id: "a" }] } })).toMatchObject([{ id: "a" }]);
  });

  it("handles { rows: [{ category, dramas: [...] }] } (dramanova recommend)", () => {
    const r = firstArray({ rows: [{ category: "hot", dramas: [{ id: "d1" }] }] });
    expect(r).toMatchObject([{ id: "d1" }]);
  });

  it("handles { cell: { cell_data: [{ books: [...] }] } } (melolo)", () => {
    const r = firstArray({ cell: { cell_data: [{ name: "x", books: [{ id: "b1" }] }] } });
    expect(r).toMatchObject([{ id: "b1" }]);
  });
});

describe("unique", () => {
  it("dedupes by key, drops empties", () => {
    const out = unique(
      [{ k: "a" }, { k: "a" }, { k: "" }, { k: "b" }],
      (x) => x.k
    );
    expect(out).toHaveLength(2);
  });
});

describe("stream helpers", () => {
  it("findStreamUrl + streamTypeFromUrl for m3u8", () => {
    const url = findStreamUrl({ data: { video: { video_720: "https://x/720.m3u8" } } });
    expect(url).toBe("https://x/720.m3u8");
    expect(streamTypeFromUrl(url!)).toBe("m3u8");
  });
});

// Dramawave resolves streams from the detail response's episode_info (the
// /play endpoint 404s on the gateway). normalizeStream must pick H264 (not
// H265/HEVC, which goes black on Chrome/Firefox) and match the requested episode.
const ep = (index: number, h264: string, h265: string) => ({
  index,
  external_audio_h264_m3u8: h264,
  external_audio_h265_m3u8: h265,
});
const detailPayload = {
  code: 200,
  data: {
    key: "d1",
    title: "Drama",
    episode_info: ep(1, "https://v/h264-ep1.m3u8", "https://v/h265-ep1.m3u8"),
    episodes: [
      { index: 1, episode_info: ep(1, "https://v/h264-ep1.m3u8", "https://v/h265-ep1.m3u8") },
      { index: 2, episode_info: ep(2, "https://v/h264-ep2.m3u8", "https://v/h265-ep2.m3u8") },
    ],
  },
};

const makeCtx = (episodeNumber: number): SapimuCtx => ({
  code: "dramawave",
  get: async () => null,
  fields: {},
  episodeId: `d1:${episodeNumber}`,
  episodeNumber,
});

describe("dramawave normalizeStream", () => {
  const normalize = dramawave.overrides!.normalizeStream!;

  it("picks H264 (never H265) for episode 1", () => {
    const r = normalize(detailPayload, makeCtx(1));
    expect(r?.streamUrl).toBe("https://v/h264-ep1.m3u8");
    expect(r?.streamType).toBe("m3u8");
  });

  it("matches the requested episode by index, not the featured one", () => {
    const r = normalize(detailPayload, makeCtx(2));
    expect(r?.streamUrl).toBe("https://v/h264-ep2.m3u8");
  });

  it("returns undefined when the episode index is absent (no wrong-episode fallback)", () => {
    const r = normalize(detailPayload, makeCtx(99));
    expect(r).toBeUndefined();
  });

  it("falls back to H265 only when H264 is absent (Safari can play it)", () => {
    const onlyH265 = { data: { episode_info: { index: 1, external_audio_h265_m3u8: "https://v/h265.m3u8" } } };
    expect(normalize(onlyH265, makeCtx(1))?.streamUrl).toBe("https://v/h265.m3u8");
  });
});
