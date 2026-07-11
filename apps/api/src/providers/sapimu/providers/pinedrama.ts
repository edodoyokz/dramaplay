import { defineSapimuProvider } from "../core/define";
import { findSubtitleUrl } from "../base";
import type { SapimuCtx } from "../core/types";

export const pinedrama = defineSapimuProvider({
  code: "pinedrama",
  endpoints: {
    trending: "/pinedrama/api/drama/search?keyword=cinta&language=id&region=ID",
    latest: "/pinedrama/api/drama/search?keyword=suami&language=id&region=ID",
    vip: "/pinedrama/api/drama/search?keyword=ceo&language=id&region=ID",
    foryou: "/pinedrama/api/drama/search?keyword=cinta&language=id&region=ID",
    search: "/pinedrama/api/drama/search?keyword={q}&language=id&region=ID",
    detail: "/pinedrama/api/drama/detail?collection_id={id}&language=id&region=ID",
    play: "/pinedrama/api/drama/play?collection_id={id}&episode={ep}&language=in&region=ID",
  },
  fields: {},
  subtitlePolicy: "external",
  overrides: {
    // Pinedrama quirk: language=in gives H264 video but Chinese subs.
    // Fetch subtitle separately from language=id (Indonesian locale, HEVC video but Indonesian subs).
    async extractSubtitle(data: unknown, ctx: SapimuCtx) {
      const idLocalePath = ctx._playPath?.replace("language=in", "language=id");
      if (!idLocalePath) return undefined;
      const subData = await ctx.get<unknown>(idLocalePath).catch(() => null);
      const url = findSubtitleUrl(subData) ?? findSubtitleUrl(data);
      return url ? { url, language: "id" } : undefined;
    },
  },
});
