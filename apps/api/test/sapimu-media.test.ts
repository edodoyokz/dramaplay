import { describe, expect, it } from "vitest";
import { subtitleFormatFromUrl, isRenderableSubtitle, srtToVtt } from "../src/providers/sapimu/core/media";

describe("subtitle format", () => {
  it("detects vtt", () => expect(subtitleFormatFromUrl("https://x/a.vtt")).toBe("vtt"));
  it("detects srt", () => expect(subtitleFormatFromUrl("https://x/a.srt")).toBe("srt"));
  it("defaults srt when unknown ext", () =>
    expect(subtitleFormatFromUrl("https://x/sub?id=1")).toBe("srt"));
  it("allows srt through (proxy converts to vtt)", () => {
    expect(isRenderableSubtitle("https://x/a.vtt")).toBe(true);
    expect(isRenderableSubtitle("https://x/a.srt")).toBe(true);
  });
  it("converts srt timestamps to vtt", () => {
    const vtt = srtToVtt("1\n00:00:01,000 --> 00:00:02,500\nHalo\n");
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:01.000 --> 00:00:02.500");
    expect(vtt).toContain("Halo");
  });
});
