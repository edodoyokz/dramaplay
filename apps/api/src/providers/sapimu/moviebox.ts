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

function coverUrl(cover: unknown): string | undefined {
  if (typeof cover === "string") return cover;
  if (cover && typeof cover === "object") return s((cover as Row).url);
  return undefined;
}

function yearFromDate(v: unknown): number | undefined {
  const raw = s(v);
  if (!raw) return undefined;
  const y = Number(raw.slice(0, 4));
  return Number.isFinite(y) && y > 1900 ? y : undefined;
}

export class MovieBoxAdapter extends SapimuBaseAdapter {
  constructor(baseUrl: string, token: string) {
    super("moviebox", baseUrl, token);
  }

  private mapSummary(row: Row): ProviderDramaSummary | null {
    const id = s(row.subjectId);
    if (!id) return null;
    return {
      providerDramaId: id,
      title: s(row.title) ?? "Untitled",
      posterUrl: coverUrl(row.cover),
      genres: s(row.genre)?.split(",").map((x) => x.trim()).filter(Boolean),
      year: yearFromDate(row.releaseDate),
      contentType: "longform",
    };
  }

  private async home(): Promise<ProviderDramaSummary[]> {
    const data = await this.getJson<{ data?: Row[] }>(`/moviebox/api/tabs/home-content?lang=id`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "User-Agent": "Mozilla/5.0",
      },
    });
    const seen = new Set<string>();
    const items: ProviderDramaSummary[] = [];
    for (const row of data.data ?? []) {
      const item = this.mapSummary(row);
      if (!item || seen.has(item.providerDramaId)) continue;
      seen.add(item.providerDramaId);
      items.push(item);
    }
    return items;
  }

  async fetchForYou() {
    return { items: await this.home() };
  }

  async fetchTrending() {
    return this.home();
  }

  async fetchLatest() {
    return this.home();
  }

  async fetchVip() {
    return this.home();
  }

  async search(query: string): Promise<ProviderDramaSummary[]> {
    const data = await this.getJson<{ data?: Row[] | { items?: Row[] } }>(
      `/moviebox/api/subject/search?keyword=${q(query)}&page=1&perPage=20`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "User-Agent": "Mozilla/5.0",
        },
      },
    );
    const rows = Array.isArray(data.data)
      ? data.data
      : ((data.data as { items?: Row[] } | undefined)?.items ?? []);
    return rows.map((row) => this.mapSummary(row)).filter((x): x is ProviderDramaSummary => Boolean(x));
  }

  async fetchDetail(providerDramaId: string): Promise<ProviderDramaDetail | null> {
    const data = await this.getJson<{ data?: Row }>(
      `/moviebox/api/subject/get?subjectId=${q(providerDramaId)}&lang=id`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "User-Agent": "Mozilla/5.0",
        },
      },
    );
    const row = data.data;
    if (!row) return null;
    const episodes = Array.isArray(row.episodes) ? (row.episodes as Row[]) : [];
    const isMovie =
      episodes.length <= 1 &&
      episodes.every((ep) => (n(ep.episode) ?? 0) <= 0 && (n(ep.se) ?? 0) <= 0);
    return {
      providerDramaId: s(row.subjectId) ?? providerDramaId,
      title: s(row.title) ?? "Untitled",
      posterUrl: coverUrl(row.cover),
      synopsis: s(row.description),
      country: s(row.countryName),
      language: s(row.language),
      year: yearFromDate(row.releaseDate),
      genres: s(row.genre)?.split(",").map((x) => x.trim()).filter(Boolean),
      contentType: "longform",
      mediaType: isMovie ? "movie" : "series",
      episodeCount: Math.max(1, episodes.length),
    };
  }

  async fetchEpisodes(providerDramaId: string): Promise<ProviderEpisodeSummary[]> {
    const data = await this.getJson<{ data?: Row }>(
      `/moviebox/api/subject/get?subjectId=${q(providerDramaId)}&lang=id`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "User-Agent": "Mozilla/5.0",
        },
      },
    );
    const episodes = Array.isArray(data.data?.episodes) ? (data.data!.episodes as Row[]) : [];
    if (!episodes.length) {
      return [
        {
          providerEpisodeId: `${providerDramaId}:1:1`,
          episodeNumber: 1,
          title: s(data.data?.title) ?? "Episode 1",
        },
      ];
    }
    return episodes.map((ep, i) => {
      const se = n(ep.se) ?? 0;
      const num = n(ep.episode) ?? 0;
      return {
        providerEpisodeId: `${providerDramaId}:${se}:${num}`,
        episodeNumber: num > 0 ? num : i + 1,
        title: s(ep.title),
        durationSeconds: n(ep.duration),
      };
    });
  }

  async resolveStream(providerEpisodeId: string): Promise<ProviderStreamSource | null> {
    const [subjectId, seRaw = "1", epRaw = "1"] = providerEpisodeId.split(":");
    if (!subjectId) return null;
    const se = Number(seRaw) || 0;
    const ep = Number(epRaw) || 0;
    const data = await this.getJson<{ data?: Row }>(
      `/moviebox/api/stream/${q(subjectId)}?ep=${q(String(ep || 1))}&se=${q(String(se || 1))}&subjectId=${q(subjectId)}&lang=id`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "User-Agent": "Mozilla/5.0",
        },
      },
    );
    const streamUrl = s(data.data?.resourceLink);
    if (!streamUrl) return null;
    return {
      streamUrl,
      streamType: streamUrl.includes(".m3u8") ? "m3u8" : "mp4",
      quality: s(data.data?.resolution),
    };
  }
}
