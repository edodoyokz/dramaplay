import { describe, expect, it } from "vitest";
import { subtitleFormatFromUrl, isRenderableSubtitle } from "../src/providers/sapimu/core/media";

describe("subtitle format", () => {
  it("detects vtt", () => expect(subtitleFormatFromUrl("https://x/a.vtt")).toBe("vtt"));
  it("detects srt", () => expect(subtitleFormatFromUrl("https://x/a.srt")).toBe("srt"));
  it("defaults srt when unknown ext", () =>
    expect(subtitleFormatFromUrl("https://x/sub?id=1")).toBe("srt"));
  it("renderable only for vtt or non-srt", () => {
    expect(isRenderableSubtitle("https://x/a.vtt")).toBe(true);
    expect(isRenderableSubtitle("https://x/a.srt")).toBe(false);
  });
});
