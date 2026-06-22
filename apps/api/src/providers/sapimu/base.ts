import { BaseProviderAdapter } from "../base";
import type {
  ProviderAdapter,
  ProviderDramaDetail,
  ProviderDramaSummary,
  ProviderEpisodeSummary,
  ProviderStreamSource,
} from "@dramaplay/shared";

type Row = Record<string, unknown>;

/** Sapimu-specific base adapter. Extends BaseProviderAdapter with token auth and common helpers. */
export abstract class SapimuBaseAdapter extends BaseProviderAdapter {
  declare code: string;
  protected token: string;

  constructor(code: string, baseUrl: string, token: string) {
    super(baseUrl);
    this.code = code;
    this.token = token;
  }

  /**
   * @internal — public for test double pattern.
   * Subclasses call this for all HTTP calls; override in tests.
   */
  get<T>(path: string): Promise<T> {
    return this.getJson<T>(path, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "User-Agent": "Mozilla/5.0",
      },
    });
  }
}

/** Walk a nested object/array and return the first string that looks like a stream URL. */
export function findStreamUrl(value: unknown): string | undefined {
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
  for (const key of [
    "url",
    "streamUrl",
    "videoUrl",
    "video_url",
    "playUrl",
    "play_url",
    "src",
    "m3u8",
    "mp4",
    "video_720",
    "video_1080",
  ]) {
    const found = findStreamUrl(row[key]);
    if (found) return found;
  }
  for (const child of Object.values(row)) {
    const found = findStreamUrl(child);
    if (found) return found;
  }
  return undefined;
}

/** Detect stream type from URL extension. */
export function streamTypeFromUrl(url: string): ProviderStreamSource["streamType"] {
  if (url.includes(".m3u8")) return "m3u8";
  if (url.includes(".mp4")) return "mp4";
  return "other";
}

/**
 * Extract first usable array from a nested response.
 * Handles both flat arrays (search results) and module-wrapped arrays
 * (dramawave feed: { data: { items: [{ type: "x", items: [drama1, drama2] }] }).
 */
export function firstArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === "object" && value[0] !== null && "items" in (value[0] as object)) {
      return (value as unknown[]).flatMap((item: any) =>
        Array.isArray(item?.items) ? item.items : []
      );
    }
    return value as unknown[];
  }
  if (!value || typeof value !== "object") return [];
  const row = value as Row;
  for (const key of ["data", "items", "list", "rows", "records", "result", "dramas", "episodes"]) {
    const v = row[key];
    if (Array.isArray(v)) {
      if (v.length > 0 && typeof v[0] === "object" && v[0] !== null && "items" in (v[0] as object)) {
        return v.flatMap((item: any) =>
          Array.isArray(item?.items) ? item.items : []
        );
      }
      return v as unknown[];
    }
    if (v && typeof v === "object") {
      const nested = firstArray(v);
      if (nested.length) return nested;
    }
  }
  return [];
}

/** Safe string helper. */
export function s(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

/** Safe number helper. */
export function n(v: unknown): number | undefined {
  return typeof v === "number" ? v : typeof v === "string" ? (Number(v) || undefined) : undefined;
}

/** Deduplicate an array by a string-returning key function. */
export function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ─── Config-driven adapter factory ──────────────────────────────────────────
// ponytail: field mappings are best-effort from endpoint docs only; refine
// during live smoke testing (Task 8). Tries common field name variants so
// adapters work even when exact response shape is unknown.

const ID_FIELDS = ["key", "id", "bookId", "dramaId", "_id", "shortId", "book_id", "drama_id"];
const TITLE_FIELDS = ["title", "name", "bookName", "dramaName", "book_name", "drama_name", "bookTitle"];
const POSTER_FIELDS = ["cover", "poster", "image", "thumb", "thumbnail", "coverUrl", "posterUrl", "img", "pic"];
const SYNOPSIS_FIELDS = ["desc", "description", "synopsis", "summary", "intro", "content"];
const COUNT_FIELDS = ["episodes", "episodeCount", "episode_count", "totalEpisodes", "total_episodes", "chapterCount", "chapters"];

function pickString(row: Row, fields: string[]): string | undefined {
  for (const f of fields) {
    const v = row[f];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number" && v) return String(v);
  }
  return undefined;
}

function pickNumber(row: Row, fields: string[]): number | undefined {
  for (const f of fields) {
    const v = row[f];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v && /^\d+$/.test(v)) return Number(v);
  }
  return undefined;
}

function pickGenres(row: Row): string[] | undefined {
  for (const f of ["tag", "tags", "genre", "genres", "content_tags", "category", "categories"]) {
    const v = row[f];
    if (Array.isArray(v) && v.length) return v.map(String);
  }
  return undefined;
}

export interface SapimuAdapterConfig {
  /** Path templates. Use {q} for search query, {id} for drama id, {ep} for episode number. */
  trending?: string;
  latest?: string;
  vip?: string;
  foryou?: string;
  search: string;
  detail: string;
  /** If detail response includes episode list, set this to extract episode count field. */
  episodesFromDetail?: boolean;
  /** Episode play path. Use {id} and {ep}. */
  play: string;
}

function rowToSummary(row: Row): ProviderDramaSummary {
  return {
    providerDramaId: String(pickString(row, ID_FIELDS) ?? ""),
    title: String(pickString(row, TITLE_FIELDS) ?? "Untitled"),
    posterUrl: pickString(row, POSTER_FIELDS),
    genres: pickGenres(row),
  };
}

function rowsToSummaries(data: unknown): ProviderDramaSummary[] {
  return unique(firstArray(data).map((r) => rowToSummary(r as Row)), (x) => x.providerDramaId);
}

/**
 * Create a concrete Sapimu provider adapter from endpoint paths.
 * Field mappings use common-name fallbacks — no per-provider field config needed.
 */
export function createSapimuAdapter(
  code: string,
  baseUrl: string,
  token: string,
  cfg: SapimuAdapterConfig
): ProviderAdapter {
  const q = (v: string) => encodeURIComponent(v);

  class CfgAdapter extends SapimuBaseAdapter {
    constructor() {
      super(code, baseUrl, token);
    }

    async fetchForYou(_cursor?: string) {
      const path = cfg.foryou ?? cfg.latest ?? cfg.trending;
      const data = path ? await this.get<unknown>(path) : { data: [] };
      return { items: rowsToSummaries(data) };
    }
    async fetchTrending() {
      const data = cfg.trending ? await this.get<unknown>(cfg.trending) : { data: [] };
      return rowsToSummaries(data);
    }
    async fetchLatest() {
      const data = cfg.latest ? await this.get<unknown>(cfg.latest) : { data: [] };
      return rowsToSummaries(data);
    }
    async fetchVip() {
      const data = cfg.vip ? await this.get<unknown>(cfg.vip) : { data: [] };
      return rowsToSummaries(data);
    }
    async search(query: string) {
      const data = await this.get<unknown>(cfg.search.replace("{q}", q(query)));
      return rowsToSummaries(data);
    }

    async fetchDetail(id: string): Promise<ProviderDramaDetail | null> {
      const data = await this.get<unknown>(cfg.detail.replace("{id}", q(id)));
      const row = (firstArray(data)[0] as Row) ?? null;
      if (!row) return null;
      const episodes = await this.fetchEpisodes(id);
      return {
        ...rowToSummary(row),
        synopsis: pickString(row, SYNOPSIS_FIELDS),
        episodeCount: episodes.length || pickNumber(row, COUNT_FIELDS),
        episodes,
      };
    }

    async fetchEpisodes(id: string): Promise<ProviderEpisodeSummary[]> {
      if (!cfg.episodesFromDetail) {
        // No separate episodes endpoint; derive from detail episode count.
        const data = await this.get<unknown>(cfg.detail.replace("{id}", q(id)));
        const row = (firstArray(data)[0] as Row) ?? {};
        const total = pickNumber(row, COUNT_FIELDS) ?? 0;
        return Array.from({ length: total }, (_, i) => ({
          providerEpisodeId: `${id}:${i + 1}`,
          episodeNumber: i + 1,
          title: `Episode ${i + 1}`,
        }));
      }
      // Detail includes an episode array — extract it.
      const data = await this.get<unknown>(cfg.detail.replace("{id}", q(id)));
      const row = (firstArray(data)[0] as Row) ?? {};
      const epList = firstArray(row);
      return epList.map((e, i) => ({
        providerEpisodeId: String(pickString(e as Row, ID_FIELDS) ?? `${id}:${i + 1}`),
        episodeNumber: pickNumber(e as Row, ["episode", "episodeNo", "number", "sort"]) ?? i + 1,
        title: pickString(e as Row, TITLE_FIELDS) ?? `Episode ${i + 1}`,
      }));
    }

    async resolveStream(episodeId: string): Promise<ProviderStreamSource | null> {
      const [id, ep = "1"] = episodeId.split(":");
      const data = await this.get<unknown>(cfg.play.replace("{id}", q(id)).replace("{ep}", q(ep)));
      const url = findStreamUrl(data);
      if (!url) return null;
      return { streamUrl: url, streamType: streamTypeFromUrl(url) };
    }
  }

  return new CfgAdapter();
}
