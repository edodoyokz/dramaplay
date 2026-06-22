import { describe, expect, it } from "vitest";
import { findStreamUrl, streamTypeFromUrl, firstArray, s, n, unique } from "../src/providers/sapimu/base";

describe("Sapimu base helpers", () => {
  describe("findStreamUrl", () => {
    it("finds direct URL string", () => {
      expect(findStreamUrl("https://cdn.test/a.m3u8")).toBe("https://cdn.test/a.m3u8");
    });

    it("finds nested video URL", () => {
      expect(findStreamUrl({ data: { video: { video_720: "https://x.test/a.m3u8" } } })).toBe(
        "https://x.test/a.m3u8"
      );
    });

    it("finds in arrays", () => {
      expect(findStreamUrl([null, { url: "https://x.mp4" }, {}])).toBe("https://x.mp4");
    });

    it("returns undefined for no URL", () => {
      expect(findStreamUrl({ foo: "bar" })).toBeUndefined();
      expect(findStreamUrl(null)).toBeUndefined();
      expect(findStreamUrl(123)).toBeUndefined();
    });
  });

  describe("streamTypeFromUrl", () => {
    it("detects m3u8", () => {
      expect(streamTypeFromUrl("https://x.test/main.m3u8")).toBe("m3u8");
    });
    it("detects mp4", () => {
      expect(streamTypeFromUrl("https://x.test/v.mp4")).toBe("mp4");
    });
    it("returns other for unknown", () => {
      expect(streamTypeFromUrl("https://x.test/v")).toBe("other");
    });
  });

  describe("firstArray", () => {
    it("returns direct array", () => {
      expect(firstArray([{ id: 1 }])).toEqual([{ id: 1 }]);
    });
    it("finds nested data array", () => {
      expect(firstArray({ data: [{ id: 1 }] })).toEqual([{ id: 1 }]);
    });
    it("finds nested items array", () => {
      expect(firstArray({ data: { items: [{ id: 2 }] } })).toEqual([{ id: 2 }]);
    });
    it("returns empty for no array", () => {
      expect(firstArray({ foo: "bar" })).toEqual([]);
      expect(firstArray(null)).toEqual([]);
    });
  });

  describe("s / n", () => {
    it("s returns string or undefined", () => {
      expect(s("hello")).toBe("hello");
      expect(s("")).toBeUndefined();
      expect(s(null)).toBeUndefined();
      expect(s(123)).toBeUndefined();
    });
    it("n returns number or undefined", () => {
      expect(n(42)).toBe(42);
      expect(n("42")).toBe(42);
      expect(n("")).toBeUndefined();
      expect(n(null)).toBeUndefined();
    });
  });

  describe("unique", () => {
    it("deduplicates by key", () => {
      expect(unique([{ id: "a" }, { id: "b" }, { id: "a" }], (x) => x.id)).toEqual([
        { id: "a" },
        { id: "b" },
      ]);
    });
    it("keeps first occurrence", () => {
      expect(unique([{ id: "a", v: 1 }, { id: "a", v: 2 }], (x) => x.id)).toEqual([{ id: "a", v: 1 }]);
    });
  });
});
