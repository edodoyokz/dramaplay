import { defineSapimuProvider } from "../core/define";

type Row = Record<string, unknown>;

function pickVideoUrl(data: unknown): string | undefined {
  const videos = (data as Row)?.videos;
  if (!Array.isArray(videos)) return undefined;
  const row = videos.find((v) => (v as Row)?.main_url || (v as Row)?.backup_url) as Row | undefined;
  return typeof row?.main_url === "string" ? row.main_url : typeof row?.backup_url === "string" ? row.backup_url : undefined;
}

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
  overrides: {
    normalizeStream(data) {
      const streamUrl = pickVideoUrl(data);
      return streamUrl ? { streamUrl, streamType: "mp4" } : undefined;
    },
  },
});
