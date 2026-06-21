import type {
  ProviderAdapter,
  ProviderDramaDetail,
  ProviderDramaSummary,
  ProviderEpisodeSummary,
  ProviderStreamSource,
} from "@dramaplay/shared";

export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract code: string;
  protected baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  protected async getJson<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`${this.code}: ${res.status}`);
    return res.json() as Promise<T>;
  }

  abstract fetchForYou(cursor?: string): Promise<{
    items: ProviderDramaSummary[];
    nextCursor?: string;
  }>;
  abstract fetchTrending(): Promise<ProviderDramaSummary[]>;
  abstract fetchLatest(): Promise<ProviderDramaSummary[]>;
  abstract fetchVip(): Promise<ProviderDramaSummary[]>;
  abstract search(query: string): Promise<ProviderDramaSummary[]>;
  abstract fetchDetail(providerDramaId: string): Promise<ProviderDramaDetail | null>;
  abstract fetchEpisodes(providerDramaId: string): Promise<ProviderEpisodeSummary[]>;
  abstract resolveStream(providerEpisodeId: string): Promise<ProviderStreamSource | null>;
}
