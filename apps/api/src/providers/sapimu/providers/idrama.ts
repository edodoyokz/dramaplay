import { defineSapimuProvider } from "../core/define";

const L = "lang=id";

// idrama playback uses POST /unlock/:dramaId?episode=N — playMethod set below.
// Global v2 field fallbacks cover common id/title/poster shapes; add fields/
// overrides here only if live payload proves otherwise.
export const idrama = defineSapimuProvider({
  code: "idrama",
  endpoints: {
    trending: `/idrama/api/v1/ranking/trending?page=1&limit=20&${L}`,
    latest: `/idrama/api/v1/latest?page=1&limit=20&${L}`,
    vip: `/idrama/api/v1/ranking/hits?page=1&limit=20&${L}`,
    foryou: `/idrama/api/v1/popular?page=1&limit=20&${L}`,
    search: `/idrama/api/v1/search?q={q}&page_size=20&${L}`,
    detail: `/idrama/api/v1/drama/{id}?${L}`,
    play: `/idrama/api/v1/unlock/{id}?episode={ep}&${L}`,
  },
  playMethod: "POST",
  fields: {},
  subtitlePolicy: "unknown",
});
