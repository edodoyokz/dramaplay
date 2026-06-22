import type { ProviderDramaDetail, ProviderDramaSummary, ProviderEpisodeSummary, ProviderStreamSource } from "@dramaplay/shared";
import { BaseProviderAdapter } from "./base";

type Row = Record<string, unknown>;

function s(v: unknown) {
  return typeof v === "string" && v ? v : undefined;
}

function n(v: unknown) {
  return typeof v === "number" ? v : Number(v) || undefined;
}

function unique<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export class SapimuProviderAdapter extends BaseProviderAdapter {
  declare code: string;

  constructor(code: string, baseUrl: string, private token: string) {
    super(baseUrl);
    this.code = code;
  }

  private get<T>(path: string) {
    return this.getJson<T>(path, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "User-Agent": "Mozilla/5.0",
      },
    });
  }

  async fetchForYou() {
    return { items: await this.fetchLatest() };
  }

  async fetchTrending() {
    const data = await this.get<{ data?: Row[] }>("/shortmax/api/v1/feed/ranked?lang=id");
    return unique((data.data ?? []).map(toShortmaxSummary), (x) => x.providerDramaId);
  }

  async fetchLatest() {
    const data = await this.get<{ data?: Row[] }>("/shortmax/api/v1/feed/new?lang=id");
    return unique((data.data ?? []).map(toShortmaxSummary), (x) => x.providerDramaId);
  }

  async fetchVip() {
    const data = await this.get<{ data?: Row[] }>("/shortmax/api/v1/feed/vip?lang=id");
    return unique((data.data ?? []).map(toShortmaxSummary), (x) => x.providerDramaId);
  }

  async search(query: string) {
    const data = await this.get<{ data?: Row[] }>(`/shortmax/api/v1/search?q=${encodeURIComponent(query)}&lang=id&page=1`);
    return unique((data.data ?? []).map(toShortmaxSummary), (x) => x.providerDramaId);
  }

  async fetchDetail(id: string): Promise<ProviderDramaDetail | null> {
    const data = await this.get<{ data?: Row }>(`/shortmax/api/v1/detail/${encodeURIComponent(id)}?lang=id`);
    if (!data.data) return null;
    const summary = toShortmaxSummary(data.data);
    return {
      ...summary,
      synopsis: s(data.data.summary),
      episodeCount: n(data.data.episodes),
      episodes: await this.fetchEpisodes(id),
    };
  }

  async fetchEpisodes(id: string): Promise<ProviderEpisodeSummary[]> {
    const detail = await this.get<{ data?: Row }>(`/shortmax/api/v1/detail/${encodeURIComponent(id)}?lang=id`);
    const total = n(detail.data?.episodes) ?? 0;
    // ponytail: provider detail only gives count; synthesize IDs as code:episode.
    return Array.from({ length: total }, (_, i) => ({
      providerEpisodeId: `${id}:${i + 1}`,
      episodeNumber: i + 1,
      title: `Episode ${i + 1}`,
    }));
  }

  async resolveStream(episodeId: string): Promise<ProviderStreamSource | null> {
    const [code, ep = "1"] = episodeId.split(":");
    const data = await this.get<{ data?: Row }>(`/shortmax/api/v1/play/${encodeURIComponent(code)}?ep=${encodeURIComponent(ep)}&lang=id`);
    // ponytail: walk response tree for any http url; Sapimu nests differently per provider.
    const url = findStreamUrl(data.data ?? data);
    if (!url) return null;
    return { streamUrl: url, streamType: url.includes(".m3u8") ? "m3u8" : url.includes(".mp4") ? "mp4" : "other" };
  }
}

function findStreamUrl(value: unknown): string | undefined {
  if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStreamUrl(item);
      if (found) return found;
    }
    return undefined;
  }
  const row = value as Row;
  for (const key of ["url", "videoUrl", "video_url", "playUrl", "play_url", "src", "m3u8", "mp4"]) {
    const found = findStreamUrl(row[key]);
    if (found) return found;
  }
  for (const child of Object.values(row)) {
    const found = findStreamUrl(child);
    if (found) return found;
  }
  return undefined;
}

function toShortmaxSummary(row: Row): ProviderDramaSummary {
  return {
    providerDramaId: String(row.code ?? row.id ?? ""),
    title: String(row.name ?? row.title ?? "Untitled"),
    posterUrl: s(row.cover ?? row.posterUrl ?? row.image),
  };
}
