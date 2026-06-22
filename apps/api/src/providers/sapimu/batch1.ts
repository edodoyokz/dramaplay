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

    // dramaboxbaru: upstream currently 500 (server down). Paths ready for when it recovers.
    dramaboxbaru: mk("dramaboxbaru", {
      trending: "/dramaboxbaru/api/rank?lang=id",
      latest: "/dramaboxbaru/api/home?lang=id",
      vip: "/dramaboxbaru/api/recommend/book?lang=id",
      foryou: "/dramaboxbaru/api/home?lang=id",
      search: "/dramaboxbaru/api/search?keyword={q}&lang=id",
      detail: "/dramaboxbaru/api/drama/{id}?lang=id",
      play: "/dramaboxbaru/api/stream?bookId={id}&episode={ep}&lang=id",
    }),

    // dramanova: /dramas (flat rows), /recommend (module-wrapped); detail 500s (auth).
    dramanova: mk("dramanova", {
      trending: "/dramanova/api/v1/dramas?lang=id",
      latest: "/dramanova/api/v1/dramas?lang=id",
      vip: "/dramanova/api/v1/recommend?lang=id",
      foryou: "/dramanova/api/v1/dramas?lang=id",
      search: "/dramanova/api/v1/search?q={q}&lang=id",
      detail: "/dramanova/api/v1/drama/{id}?lang=id",
      play: "/dramanova/api/video?fileId={id}&lang=id",
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

    // pinedrama: dramas live in /search (data.collections); /center returns categories only.
    pinedrama: mk("pinedrama", {
      trending: "/pinedrama/api/drama/search?keyword=love&lang=id",
      latest: "/pinedrama/api/drama/search?keyword=romance&lang=id",
      vip: "/pinedrama/api/drama/search?keyword=boss&lang=id",
      foryou: "/pinedrama/api/drama/search?keyword=love&lang=id",
      search: "/pinedrama/api/drama/search?keyword={q}&lang=id",
      detail: "/pinedrama/api/drama/detail?dramaId={id}&lang=id",
      play: "/pinedrama/api/drama/play?dramaId={id}&episode={ep}&lang=id",
    }),

    // reelshort: /feed/0 has data.lists (books); /search has data.lists; play /book/:id/chapter/:ch/video
    reelshort: mk("reelshort", {
      trending: "/reelshort/api/v1/feed/0",
      latest: "/reelshort/api/v1/feed/0",
      vip: "/reelshort/api/v1/completed",
      foryou: "/reelshort/api/v1/feed/0",
      search: "/reelshort/api/v1/search?q={q}",
      detail: "/reelshort/api/v1/book/{id}",
      play: "/reelshort/api/v1/book/{id}/chapter/{ep}/video",
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
