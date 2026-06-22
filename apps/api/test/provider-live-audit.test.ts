import { describe, expect, it } from "vitest";
import { assessProviderAudit } from "../src/providers/audit";

describe("provider live audit rules", () => {
  it("fails a provider with no episodes", () => {
    const r = assessProviderAudit({
      provider: "netshort",
      title: "Angsa",
      posterUrl: "https://x.test/p.webp",
      episodeCount: 0,
      streamUrl: "https://x.test/v.mp4",
      streamType: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      contentType: "video/mp4",
    });

    expect(r.passed).toBe(false);
    expect(r.failures).toContain("episodes_missing");
  });

  it("fails HEVC streams because Chrome/Firefox users cannot reliably play them", () => {
    const r = assessProviderAudit({
      provider: "pinedrama",
      title: "Sunset",
      posterUrl: "https://x.test/p.webp",
      episodeCount: 10,
      streamUrl: "https://x.test/v.mp4",
      streamType: "mp4",
      videoCodec: "hevc",
      audioCodec: "aac",
      contentType: "video/mp4",
    });

    expect(r.passed).toBe(false);
    expect(r.failures).toContain("video_codec_not_browser_safe");
  });

  it("fails TS segments served as text/plain with nosniff", () => {
    const r = assessProviderAudit({
      provider: "dramaboxbaru",
      title: "Drama",
      posterUrl: "https://x.test/p.webp",
      episodeCount: 10,
      streamUrl: "https://x.test/v.m3u8",
      streamType: "m3u8",
      videoCodec: "h264",
      audioCodec: "aac",
      contentType: "text/plain;charset=UTF-8",
      nosniff: true,
    });

    expect(r.passed).toBe(false);
    expect(r.failures).toContain("bad_media_content_type");
  });

  it("passes a browser-safe provider", () => {
    const r = assessProviderAudit({
      provider: "shortmax",
      title: "Cinta",
      posterUrl: "https://x.test/p.webp",
      episodeCount: 60,
      streamUrl: "https://x.test/v.m3u8",
      streamType: "m3u8",
      videoCodec: "h264",
      audioCodec: "aac",
      contentType: "video/mp2t",
    });

    expect(r.passed).toBe(true);
    expect(r.failures).toEqual([]);
  });
});
