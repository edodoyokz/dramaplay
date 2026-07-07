import { describe, expect, it } from "vitest";
import { freereels } from "../src/providers/sapimu/providers/freereels";

// freereels (mydramawave family) exposes both H264 and H265 m3u8 on the play
// response. HEVC goes black on Chrome/Firefox, so normalizeStream must pin H264.
const play = (over: Record<string, unknown> = {}) => ({
  index: 15,
  m3u8_url: "https://v/master.m3u8",
  external_audio_h264_m3u8: "https://v/h264.m3u8",
  external_audio_h265_m3u8: "https://v/h265.m3u8",
  subtitle_list: [
    { language: "en-US", subtitle: "https://v/en.vtt" },
    { language: "id-ID", subtitle: "https://v/id.vtt" },
  ],
  ...over,
});

describe("freereels normalizeStream", () => {
  const normalize = freereels.overrides!.normalizeStream!;

  it("pins H264 over H265 and m3u8_url, with the id subtitle", () => {
    const r = normalize(play(), {} as never);
    expect(r?.streamUrl).toBe("https://v/h264.m3u8");
    expect(r?.streamType).toBe("m3u8");
    expect(r?.subtitleUrl).toBe("https://v/id.vtt");
  });

  it("falls back to H265 then m3u8_url when H264 is absent", () => {
    expect(normalize(play({ external_audio_h264_m3u8: undefined }), {} as never)?.streamUrl).toBe(
      "https://v/h265.m3u8",
    );
    expect(
      normalize(play({ external_audio_h264_m3u8: undefined, external_audio_h265_m3u8: undefined }), {} as never)
        ?.streamUrl,
    ).toBe("https://v/master.m3u8");
  });

  it("returns undefined when no stream url is present", () => {
    expect(normalize({ index: 1 }, {} as never)).toBeUndefined();
  });
});
