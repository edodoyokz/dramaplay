import { defineSapimuProvider } from "../core/define";

export const reelshort = defineSapimuProvider({
  code: "reelshort",
  endpoints: {
    trending: "/reelshort/api/v1/foryou?lang=in",
    latest: "/reelshort/api/v1/new?lang=in",
    vip: "/reelshort/api/v1/completed?lang=in",
    foryou: "/reelshort/api/v1/foryou?lang=in",
    search: "/reelshort/api/v1/search?q={q}&page=1&lang=in",
    detail: "/reelshort/api/v1/book/{id}?lang=in",
    episodes: "/reelshort/api/v1/book/{id}/chapters?lang=in",
    play: "/reelshort/api/v1/book/{id}/chapter/{ep}/video?lang=in",
  },
  extra: [
    "/reelshort/api/v1/romance?lang=in",
    "/reelshort/api/v1/drama?lang=in",
    "/reelshort/api/v1/feed/42954?lang=in",
  ],
  episodePlayField: ["chapter_id"],
  fields: {},
  subtitlePolicy: "unknown",
});
