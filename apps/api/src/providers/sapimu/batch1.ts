/**
 * Batch-1 Sapimu provider adapter configs.
 * Each entry maps to createSapimuAdapter() with provider-specific endpoint paths.
 * ponytail: field mappings learned from live probe (scripts/probe-*); the
 * factory's common-name fallbacks + per-provider endpoint paths handle all
 * observed response shapes. Refine play paths during smoke if needed.
 */
import { createSapimuAdapter } from "./base";
import type { ProviderAdapter } from "@dramaplay/shared";

export function buildBatch1Adapters(baseUrl: string, token: string): Record<string, ProviderAdapter> {
  const mk = (code: string, cfg: Parameters<typeof createSapimuAdapter>[3]) =>
    createSapimuAdapter(code, baseUrl, token, cfg);

  return {
    // dramawave: feed/new, feed/popular, feed/vip; detail data.info; play /dramas/:id/play/:ep
    dramawave: mk("dramawave", {
      trending: "/dramawave/api/v1/feed/popular?lang=id-ID",
      latest: "/dramawave/api/v1/feed/new?lang=id-ID",
      vip: "/dramawave/api/v1/feed/vip?lang=id-ID",
      foryou: "/dramawave/api/v1/feed/recommend?lang=id-ID",
      search: "/dramawave/api/v1/search?q={q}&lang=id-ID",
      detail: "/dramawave/api/v1/dramas/{id}?lang=id-ID",
      play: "/dramawave/api/v1/dramas/{id}/play/{ep}?lang=id-ID",
    }),

    // dramaboxbaru: uses lang=in (Bahasa Indonesia), not id. Feed via /api/search
    // (home/rank sections also work). Play /api/stream returns raw m3u8 behind
    // auth → rawStream proxy. Fields: name/bookId/cover/chapterCount/chapterList.
    dramaboxbaru: mk("dramaboxbaru", {
      trending: "/dramaboxbaru/api/search?keyword=cinta&lang=in",
      latest: "/dramaboxbaru/api/search?keyword=raja&lang=in",
      vip: "/dramaboxbaru/api/search?keyword=a&lang=in",
      foryou: "/dramaboxbaru/api/search?keyword=cinta&lang=in",
      search: "/dramaboxbaru/api/search?keyword={q}&lang=in",
      detail: "/dramaboxbaru/api/drama/{id}?lang=in",
      play: "/dramaboxbaru/api/stream?bookId={id}&episode={ep}&lang=in",
      rawStream: true,
    }),

    // dramanova: feed /dramas?lang=in (flat rows); detail has episodes[] with
    // fileId; play /api/video?id=<fileId> returns videos[].main_url (mp4).
    dramanova: mk("dramanova", {
      trending: "/dramanova/api/v1/dramas?lang=in&page=1&size=20",
      latest: "/dramanova/api/v1/dramas?lang=in&page=1&size=20",
      vip: "/dramanova/api/v1/dramas?lang=in&page=2&size=20",
      foryou: "/dramanova/api/v1/dramas?lang=in&page=1&size=20",
      search: "/dramanova/api/v1/search?q={q}&lang=in",
      detail: "/dramanova/api/v1/drama/{id}?lang=in",
      play: "/dramanova/api/video?id={ep}&lang=in",
      episodePlayField: ["fileId"],
    }),

    // netshort: /feed/:page, /new/:page, /vip/:page; detail has episodes[]; play /episode/:id/:no
    netshort: mk("netshort", {
      trending: "/netshort/api/v1/feed/1",
      latest: "/netshort/api/v1/new/1",
      vip: "/netshort/api/v1/vip/1",
      foryou: "/netshort/api/v1/feed/1",
      search: "/netshort/api/v1/search/{q}/1",
      detail: "/netshort/api/v1/detail/{id}",
      play: "/netshort/api/v1/episode/{id}/{ep}",
    }),

    // pinedrama: dramas in /search (data.collections); detail/play use
    // collection_id + language=id + region=ID (NOT dramaId/lang). Play returns
    // data.playUrl (tiktokcdn mp4/m3u8) — public, no proxy needed.
    pinedrama: mk("pinedrama", {
      trending: "/pinedrama/api/drama/search?keyword=love&lang=id",
      latest: "/pinedrama/api/drama/search?keyword=romance&lang=id",
      vip: "/pinedrama/api/drama/search?keyword=boss&lang=id",
      foryou: "/pinedrama/api/drama/search?keyword=love&lang=id",
      search: "/pinedrama/api/drama/search?keyword={q}&lang=id",
      detail: "/pinedrama/api/drama/detail?collection_id={id}&language=id&region=ID",
      play: "/pinedrama/api/drama/play?collection_id={id}&episode={ep}&language=id&region=ID",
    }),

    // reelshort: /feed/0 data.lists (books); chapters at /book/:id/chapters
    // (separate from detail); play /book/:id/chapter/:chapter_id/video returns
    // videos[].PlayURL. chapter_id (not episode number) is the play param.
    reelshort: mk("reelshort", {
      trending: "/reelshort/api/v1/feed/0",
      latest: "/reelshort/api/v1/feed/0",
      vip: "/reelshort/api/v1/completed",
      foryou: "/reelshort/api/v1/feed/0",
      search: "/reelshort/api/v1/search?q={q}",
      detail: "/reelshort/api/v1/book/{id}",
      episodes: "/reelshort/api/v1/book/{id}/chapters?lang=in",
      play: "/reelshort/api/v1/book/{id}/chapter/{ep}/video",
      episodePlayField: ["chapter_id"],
    }),

    // melolo: bookmall cell.cell_data[*].books; detail /series; play /multi-video
    melolo: mk("melolo", {
      trending: "/melolo/api/v1/bookmall?tab=0",
      latest: "/melolo/api/v1/bookmall?tab=0",
      vip: "/melolo/api/v1/bookmall?tab=0",
      foryou: "/melolo/api/v1/bookmall?tab=0",
      search: "/melolo/api/v1/search?q={q}",
      detail: "/melolo/api/v1/series?id={id}",
      play: "/melolo/api/v1/multi-video?id={id}&episode={ep}",
    }),
  };
}
