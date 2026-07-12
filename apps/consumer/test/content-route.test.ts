import { describe, expect, it } from "vitest";
import { mediaTypeLabel, titlePath, watchPath } from "../src/lib/content-route";

describe("content-route", () => {
  it("routes shortform and longform titles separately", () => {
    expect(titlePath("abc")).toBe("/drama/abc");
    expect(titlePath("abc", "shortform")).toBe("/drama/abc");
    expect(titlePath("abc", "longform")).toBe("/title/abc");
  });

  it("routes watch pages by content type", () => {
    expect(watchPath("abc", 2)).toBe("/watch/abc/2");
    expect(watchPath("abc", 2, "longform")).toBe("/title/abc/watch/1/2");
    expect(watchPath("avatar", 1, "longform", 2)).toBe("/title/avatar/watch/2/1");
    expect(watchPath("short", 3, "shortform", 9)).toBe("/watch/short/3");
  });

  it("labels movie/series for cards", () => {
    expect(mediaTypeLabel("movie")).toBe("Film");
    expect(mediaTypeLabel("series")).toBe("Serial");
    expect(mediaTypeLabel(undefined)).toBeNull();
  });
});
