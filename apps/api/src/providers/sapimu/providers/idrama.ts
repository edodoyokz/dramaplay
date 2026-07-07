import { defineSapimuProvider } from "../core/define";

const L = "lang=id";

// iDrama API quirks:
// - List endpoints return { books, short_plays: [...] } (ranking/popular/latest/hits)
//   and { results, guess_plays: [...] } (search) — extractList handles both.
// - Playback is POST /unlock/:dramaId?episode=N — playMethod: "POST".
// - Detail is a flat object (no wrapper); episode_list has episode_order ep numbers.
// - Global field fallbacks cover short_play_name/cover_url/introduction/episode_order.
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
  fields: {
    id: ["id"],
    title: ["short_play_name"],
    poster: ["cover_url"],
  },
  subtitlePolicy: "unknown",
  overrides: {
    extractList(data) {
      const d = data as Record<string, unknown>;
      const arr = d.short_plays ?? d.guess_plays ?? d.results ?? [];
      return Array.isArray(arr) ? arr as unknown[] : [];
    },
  },
});
