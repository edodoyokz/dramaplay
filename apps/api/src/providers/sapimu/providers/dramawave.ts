import { defineSapimuProvider } from "../core/define";
import { findSubtitleUrl, streamTypeFromUrl } from "../base";
import type { ProviderStreamSource } from "@dramaplay/shared";

const endpoints = {
  trending: "/dramawave/api/v1/feed/popular?lang=id-ID",
  latest: "/dramawave/api/v1/feed/new?lang=id-ID",
  vip: "/dramawave/api/v1/feed/vip?lang=id-ID",
  foryou: "/dramawave/api/v1/feed/recommend?lang=id-ID",
  search: "/dramawave/api/v1/search?q={q}&lang=id-ID",
  detail: "/dramawave/api/v1/dramas/{id}?lang=id-ID",
  // ponytail: dramawave's /dramas/:id/play/:ep endpoint 404s on the Sapimu
  // gateway ("Episode not found" for every drama/episode, confirmed live).
  // The detail response embeds each episode's stream in episode_info, so
  // resolve streams from detail by matching the requested episode index
  // instead of the broken play endpoint. Upgrade path: if the gateway ever
  // fixes /play, restore it here and drop normalizeStream.
  play: "/dramawave/api/v1/dramas/{id}?lang=id-ID",
};

/** A dramawave episode_info object carries the playable h264/h265 m3u8 + subs. */
function isEpisodeInfo(o: unknown): o is Record<string, unknown> {
  if (!o || typeof o !== "object") return false;
  const r = o as Record<string, unknown>;
  return typeof r.external_audio_h264_m3u8 === "string" || typeof r.external_audio_h265_m3u8 === "string";
}

/** Walk the detail response for the episode_info whose index matches `ep`. */
function findEpisodeInfo(data: unknown, ep: number): Record<string, unknown> | undefined {
  const matches: Record<string, unknown>[] = [];
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    if (isEpisodeInfo(o)) {
      matches.push(o as Record<string, unknown>);
      return; // episode_info has no nested episode_info; stop descending
    }
    const vals = Array.isArray(o) ? o : Object.values(o as Record<string, unknown>);
    for (const v of vals) walk(v);
  };
  walk(data);
  // Strict index match only: never fall back to the featured episode for a
  // different ep — that would play the wrong video. No match => unavailable.
  return matches.find((m) => Number(m.index) === ep);
}

function toStream(ei: Record<string, unknown>): ProviderStreamSource | undefined {
  const url =
    (ei.external_audio_h264_m3u8 as string | undefined) ??
    (ei.external_audio_h265_m3u8 as string | undefined);
  if (!url) return undefined;
  // H264 first: HEVC (h265) only decodes in Safari; Chrome/Firefox go black.
  return { streamUrl: url, streamType: streamTypeFromUrl(url), subtitleUrl: findSubtitleUrl(ei, "id") };
}

// NOTE: dramawave is disabled in prod (providers.is_enabled=false). The Sapimu
// gateway risk-blocks /dramas/:id (detail) and 404s /play universally, so no
// per-episode stream source exists; the feed only exposes ep1 of ~49 dramas.
// This def's normalizeStream is correct and will resolve streams automatically
// once the gateway restores detail/play — re-enable the provider then.
export const dramawave = defineSapimuProvider({
  code: "dramawave",
  endpoints,
  fields: {},
  subtitlePolicy: "external",
  overrides: {
    normalizeStream(data, ctx) {
      const ep = ctx.episodeNumber ?? 1;
      const ei = findEpisodeInfo(data, ep);
      return ei ? toStream(ei) : undefined;
    },
  },
});
