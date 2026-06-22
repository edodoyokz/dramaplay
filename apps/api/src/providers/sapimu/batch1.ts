/**
 * Batch-1 Sapimu provider adapter configs.
 * Each entry maps to createSapimuAdapter() with provider-specific endpoint paths.
 * ponytail: field mappings use common-name fallbacks from base; refine during
 * live smoke testing (apps/api/scripts/smoke-sapimu-providers.ts).
 */
import { createSapimuAdapter } from "./base";
import type { ProviderAdapter } from "@dramaplay/shared";

export function buildBatch1Adapters(baseUrl: string, token: string): Record<string, ProviderAdapter> {
  const mk = (code: string, cfg: Parameters<typeof createSapimuAdapter>[3]) =>
    createSapimuAdapter(code, baseUrl, token, cfg);

  return {
    // dramaboxbaru: /api/home, /api/rank, /api/search, /api/drama/:bookId, /api/stream
    dramaboxbaru: mk("dramaboxbaru", {
      foryou: "/dramaboxbaru/api/home?lang=id",
      trending: "/dramaboxbaru/api/rank?lang=id",
      latest: "/dramaboxbaru/api/home?lang=id",
      vip: "/dramaboxbaru/api/rank?lang=id",
      search: "/dramaboxbaru/api/search?keyword={q}&lang=id",
      detail: "/dramaboxbaru/api/drama/{id}?lang=id",
      episodesFromDetail: true,
      // /api/stream expects ?bookId=&episode= query params
      play: "/dramaboxbaru/api/stream?bookId={id}&episode={ep}&lang=id",
    }),

    // dramanova: /api/v1/dramas, /api/v1/drama/:id, /api/video, /api/v1/recommend
    dramanova: mk("dramanova", {
      trending: "/dramanova/api/v1/recommend?lang=id",
      latest: "/dramanova/api/v1/dramas?lang=id",
      vip: "/dramanova/api/v1/recommend?lang=id",
      search: "/dramanova/api/v1/search?q={q}&lang=id",
      detail: "/dramanova/api/v1/drama/{id}?lang=id",
      episodesFromDetail: true,
      // /api/video expects ?fileId= from detail response; falls back to {id}:{ep}
      play: "/dramanova/api/video?fileId={id}&lang=id",
    }),

    // netshort: /api/v1/feed/:page, /api/v1/new/:page, /api/v1/vip/:page,
    // /api/v1/search/:keyword/:page, /api/v1/detail/:id, /api/v1/episode/:id/:episodeNo
    netshort: mk("netshort", {
      foryou: "/netshort/api/v1/feed/1",
      trending: "/netshort/api/v1/feed/1",
      latest: "/netshort/api/v1/new/1",
      vip: "/netshort/api/v1/vip/1",
      search: "/netshort/api/v1/search/{q}/1",
      detail: "/netshort/api/v1/detail/{id}",
      episodesFromDetail: true,
      play: "/netshort/api/v1/episode/{id}/{ep}",
    }),

    // pinedrama: /api/drama/center, /api/drama/search, /api/drama/detail,
    // /api/drama/episodes, /api/drama/play
    pinedrama: mk("pinedrama", {
      trending: "/pinedrama/api/drama/center?lang=id",
      latest: "/pinedrama/api/drama/center?lang=id",
      vip: "/pinedrama/api/drama/center?lang=id",
      search: "/pinedrama/api/drama/search?keyword={q}&lang=id",
      detail: "/pinedrama/api/drama/detail?dramaId={id}&lang=id",
      episodesFromDetail: false,
      // episodes + play use query params on the same base
      play: "/pinedrama/api/drama/play?dramaId={id}&episode={ep}&lang=id",
    }),

    // reelshort: /api/v1/foryou, /api/v1/new, /api/v1/search, /api/v1/book/:id,
    // /api/v1/book/:id/chapters, /api/v1/book/:id/chapter/:chapterId/video
    reelshort: mk("reelshort", {
      foryou: "/reelshort/api/v1/foryou",
      trending: "/reelshort/api/v1/foryou",
      latest: "/reelshort/api/v1/new",
      vip: "/reelshort/api/v1/completed",
      search: "/reelshort/api/v1/search?q={q}",
      detail: "/reelshort/api/v1/book/{id}",
      episodesFromDetail: true,
      // chapters use chapterId; we pass episode number as chapterId
      play: "/reelshort/api/v1/book/{id}/chapter/{ep}/video",
    }),

    // melolo: /api/v1/bookmall, /api/v1/book, /api/v1/series, /api/v1/multi-video
    melolo: mk("melolo", {
      foryou: "/melolo/api/v1/bookmall?tab=0",
      trending: "/melolo/api/v1/bookmall?tab=0",
      latest: "/melolo/api/v1/bookmall?tab=0",
      vip: "/melolo/api/v1/bookmall?tab=0",
      search: "/melolo/api/v1/search?keyword={q}",
      detail: "/melolo/api/v1/series?seriesId={id}",
      episodesFromDetail: true,
      // multi-video returns all episode URLs at once
      play: "/melolo/api/v1/multi-video?seriesId={id}&episode={ep}",
    }),
  };
}
