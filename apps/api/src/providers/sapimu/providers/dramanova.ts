import { defineSapimuProvider } from "../core/define";

export const dramanova = defineSapimuProvider({
  code: "dramanova",
  endpoints: {
    trending: "/dramanova/api/v1/dramas?lang=in&page=1&size=20",
    latest: "/dramanova/api/v1/dramas?lang=in&page=1&size=20",
    vip: "/dramanova/api/v1/dramas?lang=in&page=2&size=20",
    foryou: "/dramanova/api/v1/dramas?lang=in&page=1&size=20",
    search: "/dramanova/api/v1/search?q={q}&lang=in",
    detail: "/dramanova/api/v1/drama/{id}?lang=in",
    play: "/dramanova/api/video?id={ep}&lang=in",
  },
  episodePlayField: ["fileId"],
  fields: {},
  subtitlePolicy: "unknown",
});
