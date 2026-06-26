import { defineSapimuProvider } from "../core/define";

export const dramaboxbaru = defineSapimuProvider({
  code: "dramaboxbaru",
  endpoints: {
    trending: "/dramaboxbaru/api/rank?lang=in",
    latest: "/dramaboxbaru/api/home?lang=in",
    vip: "/dramaboxbaru/api/recommend/book?lang=in",
    foryou: "/dramaboxbaru/api/home?lang=in",
    search: "/dramaboxbaru/api/search?keyword={q}&lang=in",
    detail: "/dramaboxbaru/api/drama/{id}?lang=in",
    play: "/dramaboxbaru/api/stream?bookId={id}&episode={ep}&lang=in",
  },
  extra: [
    "/dramaboxbaru/api/hidden-gems?lang=in",
    ...Array.from({ length: 15 }, (_, i) => `/dramaboxbaru/api/browse?lang=in&type=0&page=${i + 1}`),
  ],
  rawStream: true,
  fields: {},
  subtitlePolicy: "unknown",
});
