import { defineSapimuProvider } from "../core/define";

export const netshort = defineSapimuProvider({
  code: "netshort",
  endpoints: {
    trending: "/netshort/api/v1/feed/1?lang=id_ID",
    latest: "/netshort/api/v1/new/1?lang=id_ID",
    vip: "/netshort/api/v1/vip/1?lang=id_ID",
    foryou: "/netshort/api/v1/feed/1?lang=id_ID",
    search: "/netshort/api/v1/search/{q}/1?lang=id_ID",
    detail: "/netshort/api/v1/detail/{id}?lang=id_ID",
    play: "/netshort/api/v1/episode/{id}/{ep}?lang=id_ID",
  },
  fields: {},
  subtitlePolicy: "external",
});
