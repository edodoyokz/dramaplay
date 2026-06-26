import { defineSapimuProvider } from "../core/define";

export const shortmax = defineSapimuProvider({
  code: "shortmax",
  endpoints: {
    trending: "/shortmax/api/v1/feed/ranked?lang=id",
    latest: "/shortmax/api/v1/feed/new?lang=id",
    vip: "/shortmax/api/v1/feed/vip?lang=id",
    foryou: "/shortmax/api/v1/feed/new?lang=id",
    search: "/shortmax/api/v1/search?q={q}&lang=id&page=1",
    detail: "/shortmax/api/v1/detail/{id}?lang=id",
    play: "/shortmax/api/v1/play/{id}?ep={ep}&lang=id",
  },
  // shortmax uses "code" as primary ID, "name" as title
  fields: { id: ["code"], title: ["name"] },
  subtitlePolicy: "unknown",
});
