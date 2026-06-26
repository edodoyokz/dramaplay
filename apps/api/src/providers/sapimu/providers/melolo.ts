import { defineSapimuProvider } from "../core/define";
import { findStreamUrl, findSubtitleUrl, streamTypeFromUrl } from "../base";
import type { SapimuCtx } from "../core/types";

export const melolo = defineSapimuProvider({
  code: "melolo",
  endpoints: {
    trending: "/melolo/api/v1/bookmall?tab=0&lang=id",
    latest: "/melolo/api/v1/bookmall?tab=0&lang=id",
    vip: "/melolo/api/v1/bookmall?tab=0&lang=id",
    foryou: "/melolo/api/v1/bookmall?tab=0&lang=id",
    search: "/melolo/api/v1/search?q={q}&lang=id",
    detail: "/melolo/api/v1/series?id={id}&lang=id",
    play: "/melolo/api/v1/multi-video?id={id}&episode={ep}&lang=id",
  },
  fields: {},
  subtitlePolicy: "hardsub",
  overrides: {
    // melolo /multi-video returns ALL episodes; filter to the requested one.
    selectStreamPayload(data: unknown, ctx: SapimuCtx) {
      const d = data as { episodes?: { index: number }[] };
      if (d?.episodes && ctx.episodeNumber) {
        return d.episodes.find((e) => e.index === ctx.episodeNumber);
      }
      return data;
    },
  },
});
