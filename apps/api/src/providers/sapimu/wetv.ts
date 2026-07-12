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

function isIndonesianCaption(row: Row) {
  const code = String(row.lang ?? row.language ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  const name = String(row.name ?? row.langName ?? row.lanName ?? "").trim();
  return code === "id" || code === "id-id" || /^(bahasa indonesia|indonesia)$/i.test(name);
}

export class WetvAdapter extends SapimuBaseAdapter {
  constructor(baseUrl: string, token: string) {
    super("wetv", baseUrl, token);
  }

  private mapFeedRow(row: Row): ProviderDramaSummary | null {
    const id = s(row.cid);
    if (!id) return null;
    return {
      providerDramaId: id,
      title: s(row.title) ?? "Untitled",
      posterUrl: s(row.cover),
      contentType: "longform",
    };
  }

  private async feedItems(channelId: string): Promise<ProviderDramaSummary[]> {
    const data = await this.get<{ data?: Row[] }>(
      `/wetv/api/feed?channel_id=${q(channelId)}&lang=id&country=ID`,
    );
    const seen = new Set<string>();
    const items: ProviderDramaSummary[] = [];
    for (const section of data.data ?? []) {
      for (const row of (section.items as Row[] | undefined) ?? []) {
        const item = this.mapFeedRow(row);
        if (!item || seen.has(item.providerDramaId)) continue;
        seen.add(item.providerDramaId);
        items.push(item);
      }
    }
    return items;
  }

  /** Pull every WeTV channel feed once and dedupe by cid. */
  private async allChannelItems(): Promise<ProviderDramaSummary[]> {
    const channels = await this.get<{ data?: Row[] }>(`/wetv/api/channels?lang=id&country=ID`);
    const ids = (channels.data ?? [])
      .map((c) => s(c.id))
      .filter((id): id is string => Boolean(id));
    // Fallback to the default "Untukmu" channel if channels list is empty.
    const channelIds = ids.length ? ids : ["1001"];
    const batches = await Promise.all(
      channelIds.map(async (id) => {
        try {
          return await this.feedItems(id);
        } catch (e) {
          console.error(`[wetv] feed ${id}: ${e}`);
          return [] as ProviderDramaSummary[];
        }
      }),
    );
    return [
      ...new Map(batches.flat().map((x) => [x.providerDramaId, x])).values(),
    ];
  }

  async fetchForYou() {
    return { items: await this.allChannelItems() };
  }

  async fetchTrending() {
    return this.feedItems("1001");
  }

  async fetchLatest() {
    return this.feedItems("10234");
  }

  async fetchVip() {
    return this.feedItems("10483");
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
          seasonNumber: 1,
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
    const subtitleUrl = s(subs.find((caption) => isIndonesianCaption(caption) && s(caption.url))?.url);
    return {
      streamUrl,
      streamType: streamUrl.includes(".m3u8") ? "m3u8" : "mp4",
      ...(subtitleUrl ? { subtitleUrl, subtitleLanguage: "id" as const } : {}),
    };
  }
}
