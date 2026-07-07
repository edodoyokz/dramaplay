import { defineSapimuProvider } from "../core/define";
import { findSubtitleUrl, streamTypeFromUrl } from "../base";

const L = "lang=id-ID";

export const freereels = defineSapimuProvider({
  code: "freereels",
  endpoints: {
    trending: `/freereels/api/v1/popular?page=0&${L}`,
    latest: `/freereels/api/v1/new?page=0&${L}`,
    foryou: `/freereels/api/v1/foryou?page=0&${L}`,
    search: `/freereels/api/v1/search?q={q}&${L}&limit=50`,
    detail: `/freereels/api/v1/dramas/{id}?${L}`,
    episodes: `/freereels/api/v1/dramas/{id}/episodes?${L}`,
    play: `/freereels/api/v1/dramas/{id}/play/{ep}?${L}`,
  },
  // Extra gender/genre shelves merged into the catalog alongside the feeds.
  extra: [
    `/freereels/api/v1/female?page=0&${L}`,
    `/freereels/api/v1/male?page=0&${L}`,
    `/freereels/api/v1/anime?page=0&${L}`,
    `/freereels/api/v1/dubbing?page=0&${L}`,
  ],
  fields: {},
  subtitlePolicy: "external",
  overrides: {
    // mydramawave family exposes both H264 and H265 m3u8. HEVC (h265) only
    // decodes in Safari and goes black on Chrome/Firefox, so pin H264.
    // play/{ep} returns the requested episode object directly (no walk needed).
    normalizeStream(data) {
      const ei = data as Record<string, unknown>;
      const url =
        (ei.external_audio_h264_m3u8 as string | undefined) ??
        (ei.external_audio_h265_m3u8 as string | undefined) ??
        (ei.m3u8_url as string | undefined);
      if (!url) return undefined;
      return { streamUrl: url, streamType: streamTypeFromUrl(url), subtitleUrl: findSubtitleUrl(ei, "id") };
    },
  },
});
