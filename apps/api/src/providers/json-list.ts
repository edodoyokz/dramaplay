import type {
  ProviderDramaDetail,
  ProviderDramaSummary,
  ProviderEpisodeSummary,
  ProviderStreamSource,
} from "@dramaplay/shared";
import { BaseProviderAdapter } from "./base";

type ProviderListPayload =
  | unknown[]
  | { data?: unknown[] | { list?: unknown[]; items?: unknown[] }; results?: unknown[]; cursor?: string };

function listFrom(data: ProviderListPayload): unknown[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.data)) return data.data;
  if (data.data && typeof data.data === "object") {
    if (Array.isArray(data.data.list)) return data.data.list;
    if (Array.isArray(data.data.items)) return data.data.items;
  }
  return [];
}

function getCursor(data: ProviderListPayload) {
  return Array.isArray(data) ? undefined : data.cursor;
}

function toSummaries(data: ProviderListPayload): ProviderDramaSummary[] {
  return listFrom(data).map((item) => {
    const row = item as Record<string, unknown>;
    const id = String(row.providerDramaId ?? row.bookId ?? row.shortPlayId ?? row.book_id ?? row.id ?? "");
    return {
      providerDramaId: id,
      title: String(row.title ?? row.bookName ?? row.name ?? "Untitled"),
      posterUrl: stringOrUndefined(row.posterUrl ?? row.coverWap ?? row.cover ?? row.image),
      backdropUrl: stringOrUndefined(row.backdropUrl ?? row.horizontalCover),
      genres: Array.isArray(row.genres) ? row.genres.map(String) : Array.isArray(row.tags) ? row.tags.map(String) : undefined,
      country: stringOrUndefined(row.country),
      year: typeof row.year === "number" ? row.year : undefined,
    };
  }).filter((item) => item.providerDramaId);
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

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
    const data = await this.getJson<ProviderListPayload>(
      `/${this.prefix}/foryou${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`
    );
    return { items: toSummaries(data), nextCursor: getCursor(data) };
  }

  async fetchTrending() {
    return toSummaries(await this.getJson<ProviderListPayload>(`/${this.prefix}/trending`));
  }

  async fetchLatest() {
    return toSummaries(await this.getJson<ProviderListPayload>(`/${this.prefix}/latest`));
  }

  async fetchVip() {
    return toSummaries(await this.getJson<ProviderListPayload>(`/${this.prefix}/vip`));
  }

  async search(query: string) {
    return toSummaries(
      await this.getJson<ProviderListPayload>(`/${this.prefix}/search?q=${encodeURIComponent(query)}`)
    );
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
