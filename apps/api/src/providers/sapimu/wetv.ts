import type {
  ProviderDramaDetail,
  ProviderDramaSummary,
  ProviderEpisodeSummary,
  ProviderStreamSource,
} from "@dramaplay/shared";
import { SapimuBaseAdapter } from "./base";

type Row = Record<string, unknown>;

function s(v: unknown) {
  return typeof v === "string" && v ? v : typeof v === "number" ? String(v) : undefined;
}

function n(v: unknown) {
  return typeof v === "number" ? v : Number(v) || undefined;
}

function q(v: string) {
  return encodeURIComponent(v);
}

export class WetvAdapter extends SapimuBaseAdapter {
  constructor(baseUrl: string, token: string) {
    super("wetv", baseUrl, token);
  }

  private async feedItems(channelId = "1001"): Promise<ProviderDramaSummary[]> {
    const data = await this.get<{ data?: Row[] }>(
      `/wetv/api/feed?channel_id=${q(channelId)}&lang=id&country=ID`,
    );
    const seen = new Set<string>();
    const items: ProviderDramaSummary[] = [];
    for (const section of data.data ?? []) {
      for (const row of (section.items as Row[] | undefined) ?? []) {
        const id = s(row.cid);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        items.push({
          providerDramaId: id,
          title: s(row.title) ?? "Untitled",
          posterUrl: s(row.cover),
          contentType: "longform",
        });
      }
    }
    return items;
  }

  async fetchForYou() {
    return { items: await this.feedItems() };
  }

  async fetchTrending() {
    return this.feedItems();
  }

  async fetchLatest() {
    return this.feedItems();
  }

  async fetchVip() {
    return this.feedItems();
  }

  async search(query: string): Promise<ProviderDramaSummary[]> {
    const data = await this.get<{ data?: Row[] | { items?: Row[] } }>(
      `/wetv/api/search?keyword=${q(query)}&lang=id&country=ID`,
    );
    const rows = Array.isArray(data.data)
      ? data.data
      : ((data.data as { items?: Row[] } | undefined)?.items ?? []);
    return rows
      .map((row) => ({
        providerDramaId: s(row.cid) ?? "",
        title: s(row.title) ?? "Untitled",
        posterUrl: s(row.cover) ?? s(row.posterVt),
        contentType: "longform" as const,
      }))
      .filter((x) => x.providerDramaId);
  }

  async fetchDetail(providerDramaId: string): Promise<ProviderDramaDetail | null> {
    const data = await this.get<{ data?: Row }>(
      `/wetv/api/detail?cid=${q(providerDramaId)}&lang=id&country=ID`,
    );
    const row = data.data;
    if (!row) return null;
    const total = n(row.totalEpisodes) ?? 0;
    return {
      providerDramaId: s(row.cid) ?? providerDramaId,
      title: s(row.title) ?? "Untitled",
      posterUrl: s(row.posterVt) ?? s(row.cover),
      backdropUrl: s(row.posterHz),
      synopsis: s(row.description),
      country: s(row.areaName),
      year: n(row.year),
      genres: Array.isArray(row.mainGenres) ? row.mainGenres.map(String) : undefined,
      contentType: "longform",
      mediaType: total > 1 ? "series" : "movie",
      episodeCount: total || undefined,
    };
  }

  async fetchEpisodes(providerDramaId: string): Promise<ProviderEpisodeSummary[]> {
    const data = await this.get<{ data?: Row[] }>(
      `/wetv/api/episodes?cid=${q(providerDramaId)}&lang=id&country=ID`,
    );
    return (data.data ?? [])
      .filter((row) => !row.isTrailer)
      .map((row, i) => {
        const vid = s(row.vid) ?? String(i + 1);
        const num = n(row.episode) ?? n(row.manEpisode) ?? i + 1;
        return {
          providerEpisodeId: `${providerDramaId}:${vid}`,
          episodeNumber: num,
          title: s(row.title),
          thumbnailUrl: s(row.cover),
          durationSeconds: n(row.duration),
        };
      });
  }

  async resolveStream(providerEpisodeId: string): Promise<ProviderStreamSource | null> {
    const [cid, vid] = providerEpisodeId.split(":");
    if (!cid || !vid) return null;
    const data = await this.get<{ data?: Row }>(
      `/wetv/api/play?vid=${q(vid)}&cid=${q(cid)}&defn=hd&lang=id&country=ID`,
    );
    const row = data.data;
    const streamUrl = s(row?.playUrl);
    if (!streamUrl) return null;
    const subs = Array.isArray(row?.subtitles) ? (row.subtitles as Row[]) : [];
    const idSub =
      subs.find((x) => String(x.lang ?? "").toLowerCase() === "id") ??
      subs.find((x) => /indonesia/i.test(String(x.name ?? ""))) ??
      subs[0];
    return {
      streamUrl,
      streamType: streamUrl.includes(".m3u8") ? "m3u8" : "mp4",
      subtitleUrl: s(idSub?.url),
      subtitleLanguage: idSub ? "id" : undefined,
    };
  }
}
