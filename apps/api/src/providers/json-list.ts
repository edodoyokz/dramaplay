import type {
  ProviderDramaDetail,
  ProviderDramaSummary,
  ProviderEpisodeSummary,
  ProviderStreamSource,
} from "@dramaplay/shared";
import { BaseProviderAdapter } from "./base";

/**
 * Generic JSON-list adapter. Most short-drama providers expose similar endpoint
 * shapes with `{ data: [...] }` payloads. Concrete adapters only differ in the
 * URL prefix and `code`.
 */
export class JsonListProviderAdapter extends BaseProviderAdapter {
  declare code: string;

  constructor(
    code: string,
    baseUrl: string,
    private prefix: string
  ) {
    super(baseUrl);
    this.code = code;
  }

  async fetchForYou(cursor?: string) {
    const data = await this.getJson<{ data: ProviderDramaSummary[]; cursor?: string }>(
      `/${this.prefix}/foryou${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`
    );
    return { items: data.data ?? [], nextCursor: data.cursor };
  }

  async fetchTrending() {
    const data = await this.getJson<{ data: ProviderDramaSummary[] }>(`/${this.prefix}/trending`);
    return data.data ?? [];
  }

  async fetchLatest() {
    const data = await this.getJson<{ data: ProviderDramaSummary[] }>(`/${this.prefix}/latest`);
    return data.data ?? [];
  }

  async fetchVip() {
    const data = await this.getJson<{ data: ProviderDramaSummary[] }>(`/${this.prefix}/vip`);
    return data.data ?? [];
  }

  async search(query: string) {
    const data = await this.getJson<{ data: ProviderDramaSummary[] }>(
      `/${this.prefix}/search?q=${encodeURIComponent(query)}`
    );
    return data.data ?? [];
  }

  async fetchDetail(id: string) {
    return this.getJson<ProviderDramaDetail | null>(
      `/${this.prefix}/detail?id=${encodeURIComponent(id)}`
    );
  }

  async fetchEpisodes(id: string) {
    const data = await this.getJson<{ data: ProviderEpisodeSummary[] }>(
      `/${this.prefix}/allepisode?id=${encodeURIComponent(id)}`
    );
    return data.data ?? [];
  }

  async resolveStream(episodeId: string) {
    return this.getJson<ProviderStreamSource | null>(
      `/${this.prefix}/episode?id=${encodeURIComponent(episodeId)}`
    );
  }
}
