import { defineSapimuProvider } from "../core/define";

export const dramawave = defineSapimuProvider({
  code: "dramawave",
  endpoints: {
    trending: "/dramawave/api/v1/feed/popular?lang=id-ID",
    latest: "/dramawave/api/v1/feed/new?lang=id-ID",
    vip: "/dramawave/api/v1/feed/vip?lang=id-ID",
    foryou: "/dramawave/api/v1/feed/recommend?lang=id-ID",
    search: "/dramawave/api/v1/search?q={q}&lang=id-ID",
    detail: "/dramawave/api/v1/dramas/{id}?lang=id-ID",
    play: "/dramawave/api/v1/dramas/{id}/play/{ep}?lang=id-ID",
  },
  fields: {},
  subtitlePolicy: "external",
});
