import { describe, expect, it } from "vitest";
import {
  firstArray,
  findStreamUrl,
  streamTypeFromUrl,
  unique,
} from "../src/providers/sapimu/base";

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
