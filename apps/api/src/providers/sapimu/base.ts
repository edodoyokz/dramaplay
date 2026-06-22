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

/** True if a URL looks like an image (not a video stream). */
function looksLikeImage(url: string): boolean {
  return /\.(heic|jpg|jpeg|png|webp|gif|bmp|avif|image)(\?|$)/i.test(url);
}

/** Walk a nested object/array and return the first string that looks like a stream URL. */
export function findStreamUrl(value: unknown): string | undefined {
  if (typeof value === "string" && /^https?:\/\//.test(value) && !looksLikeImage(value)) return value;
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    // Prefer browser-playable codecs: HEVC/H265 only plays in Safari, so a list
    // that mixes H264 and H265 (e.g. reelshort) must pick H264 first.
    const ordered = orderByPlayableCodec(value);
    for (const item of ordered) {
      const found = findStreamUrl(item);
      if (found) return found;
    }
    return undefined;
  }
  const row = value as Row;
  for (const key of [
    "url",
    "streamUrl",
    "stream_url",
    "main_url",
    "backup_url",
    "PlayURL",
    "playUrl",
    "play_url",
    "videoUrl",
    "video_url",
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

/**
 * Reorder candidate video objects so browser-playable codecs come first.
 * HEVC/H265 only decodes in Safari; Chrome/Firefox need H264, otherwise
 * playback yields audio-only with a black/poster frame.
 */
function orderByPlayableCodec(arr: unknown[]): unknown[] {
  const codec = (item: unknown): string => {
    const r = item as Row;
    return String(r?.Encode ?? r?.encode ?? r?.codec ?? "").toUpperCase();
  };
  if (!arr.some((i) => codec(i))) return arr;
  const rank = (c: string) => (c.includes("265") || c.includes("HEV") ? 1 : 0);
  return [...arr].sort((a, b) => rank(codec(a)) - rank(codec(b)));
}

/** Detect stream type from URL extension. */
export function streamTypeFromUrl(url: string): ProviderStreamSource["streamType"] {
  if (url.includes(".m3u8")) return "m3u8";
  if (url.includes(".mp4")) return "mp4";
  return "other";
}

function findSubtitleUrl(value: unknown, preferred = "id"): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    const rows = value.filter((v): v is Row => !!v && typeof v === "object");
    const row = rows.find((r) => String(r.lang ?? r.language ?? "").toLowerCase().startsWith(preferred)) ?? rows[0];
    return s(row?.url);
  }
  const row = value as Row;
  for (const key of ["subtitles", "subtitle", "captions", "caption"]) {
    const found = findSubtitleUrl(row[key], preferred);
    if (found) return found;
  }
  for (const child of Object.values(row)) {
    const found = findSubtitleUrl(child, preferred);
    if (found) return found;
  }
  return undefined;
}

/**
 * Check if an array item is a module wrapper: an object with a nested
 * non-empty array under one of the known wrapper keys (items/dramas/books/...).
 * Returns the flattened inner arrays across all items, or null if not wrappers.
 */
function unwrapModules(arr: unknown[]): unknown[] | null {
  if (!arr.length || typeof arr[0] !== "object" || arr[0] === null) return null;
  const first = arr[0] as Row;
  for (const wk of WRAPPER_KEYS) {
    if (Array.isArray(first[wk]) && (first[wk] as unknown[]).length) {
      return arr.flatMap((item) => {
        const o = item as Row;
        return Array.isArray(o[wk]) ? (o[wk] as unknown[]) : [];
      });
    }
  }
  return null;
}

/**
 * Extract first usable array from a nested response.
 * Handles flat arrays, module-wrapped arrays, and 2-level nesting.
 * Examples it resolves:
 *   { data: [drama] }                         (netshort)
 *   { rows: [drama] }                         (dramanova search)
 *   { rows: [{ category, dramas: [drama] }] } (dramanova recommend)
 *   { cell: [{ name, books: [drama] }] }      (melolo bookmall)
 *   { data: { items: [{ items: [drama] }] } } (dramawave feed)
 */
export function firstArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    const unwrapped = unwrapModules(value);
    return unwrapped ?? (value as unknown[]);
  }
  if (!value || typeof value !== "object") return [];
  const row = value as Row;
  for (const key of TOP_KEYS) {
    const v = row[key];
    if (Array.isArray(v)) {
      const unwrapped = unwrapModules(v);
      return unwrapped ?? (v as unknown[]);
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
// ponytail: field mappings learned from live probe (probe-sapimu.ts);
// covers all observed field-name variants across batch-1 providers.
const WRAPPER_KEYS = ["items", "dramas", "books", "list", "chapters", "episodes", "videos", "rows", "data", "lists"];
const TOP_KEYS = ["data", "items", "list", "rows", "records", "result", "dramas", "episodes", "cell", "collections", "cell_data", "lists", "bookList"];
const ID_FIELDS = ["key", "id", "bookId", "dramaId", "_id", "shortId", "book_id", "drama_id", "t_book_id", "collectionId", "collection_id", "seriesId", "series_id"];
const TITLE_FIELDS = ["title", "name", "bookName", "dramaName", "book_name", "drama_name", "bookTitle", "book_title", "book_sub_title"];
const POSTER_FIELDS = ["cover", "poster", "image", "thumb", "thumbnail", "coverUrl", "posterUrl", "img", "pic", "book_pic", "book_cover", "cover_pic", "thumb_url", "first_chapter_cover", "coverWap"];
const SYNOPSIS_FIELDS = ["desc", "description", "synopsis", "summary", "intro", "content", "abstract", "special_desc"];
const COUNT_FIELDS = ["episodes", "episodeCount", "episode_count", "totalEpisodes", "total_episodes", "chapterCount", "chapters", "chapter_count", "total_chapters", "totalChapterNum"];

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
  for (const f of ["tag", "tags", "genre", "genres", "content_tags", "category", "categories", "labels", "categoryNames", "theme", "content_tags"]) {
    const v = row[f];
    if (Array.isArray(v) && v.length) return v.map(String);
  }
  return undefined;
}

const EP_ID_FIELDS = ["episodeId", "episode_id", "chapterId", "chapter_id", "videoId", "video_id", "fileId", "file_id"];
const EP_NUM_FIELDS = ["episodeNo", "episode_no", "episode", "episodeNumber", "episode_number", "number", "sort", "index", "indexStr", "chapterNo", "chapter_no", "chapter", "serial_number", "serialNumber"];

/** Find the first object that looks like a drama row (has both a title and an id). */
function findDetailRow(data: unknown): Row | null {
  function walk(o: unknown): Row | null {
    if (!o || typeof o !== "object") return null;
    if (Array.isArray(o)) {
      for (const x of o) { const r = walk(x); if (r) return r; }
      return null;
    }
    const row = o as Row;
    if (pickString(row, TITLE_FIELDS) && pickString(row, ID_FIELDS)) return row;
    for (const v of Object.values(row)) { const r = walk(v); if (r) return r; }
    return null;
  }
  return walk(data);
}

/** Find the first array whose items look like episodes (have an episode id or number). */
function findEpisodeList(data: unknown): Row[] {
  function walk(o: unknown): Row[] {
    if (Array.isArray(o)) {
      if (o.length && typeof o[0] === "object" && o[0] !== null) {
        const it = o[0] as Row;
        if (pickString(it, EP_ID_FIELDS) || pickNumber(it, EP_NUM_FIELDS) !== undefined) return o as Row[];
      }
      return [];
    }
    if (!o || typeof o !== "object") return [];
    for (const v of Object.values(o)) { const r = walk(v); if (r.length) return r; }
    return [];
  }
  return walk(data);
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
  /**
   * Separate episodes-list endpoint (use {id}). If omitted, episodes are read
   * from the detail response. Set when the provider splits detail and chapter
   * lists (e.g. reelshort /book/:id/chapters).
   */
  episodes?: string;
  /**
   * If true, the play endpoint returns a raw stream manifest (e.g. m3u8 text)
   * that requires Authorization and cannot be fetched by a browser player.
   * The resolver returns a proxy URL (/proxy/sapimu-stream?path=...) that the
   * Worker serves with the token; the manifest's segments are public.
   */
  rawStream?: boolean;
  /**
   * Fields (in priority order) to use as the per-episode play param encoded in
   * providerEpisodeId as `${dramaId}:${playParam}`. Defaults to the episode
   * number. Set e.g. ["fileId"] when the play endpoint needs a fileId, not the
   * episode number.
   */
  episodePlayField?: string[];
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
      const row = findDetailRow(data);
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
      const path = (cfg.episodes ?? cfg.detail).replace("{id}", q(id));
      const data = await this.get<unknown>(path);
      const list = findEpisodeList(data);
      if (list.length) {
        return list.map((e, i) => {
          const num = pickNumber(e, EP_NUM_FIELDS) ?? i + 1;
          const playParam = pickString(e, cfg.episodePlayField ?? []) ?? String(num);
          return {
            providerEpisodeId: `${id}:${playParam}`,
            episodeNumber: num,
            title: pickString(e, TITLE_FIELDS) ?? `Episode ${num}`,
          };
        });
      }
      // Fallback: derive synthetic episodes from the detail's count field.
      const row = findDetailRow(data) ?? {};
      const total = pickNumber(row, COUNT_FIELDS) ?? 0;
      return Array.from({ length: total }, (_, i) => ({
        providerEpisodeId: `${id}:${i + 1}`,
        episodeNumber: i + 1,
        title: `Episode ${i + 1}`,
      }));
    }

    async resolveStream(episodeId: string): Promise<ProviderStreamSource | null> {
      const [id, ep = "1"] = episodeId.split(":");
      const playPath = cfg.play.replace("{id}", q(id)).replace("{ep}", q(ep));
      if (cfg.rawStream) {
        // Play endpoint returns a raw m3u8 manifest behind auth; expose it via
        // the Worker proxy so a browser player can play it. Segments are public.
        return {
          streamUrl: `/proxy/sapimu-stream?path=${encodeURIComponent(playPath)}`,
          streamType: "m3u8",
        };
      }
      const data = await this.get<unknown>(playPath);
      const url = findStreamUrl(data);
      if (!url) return null;
      let subtitleUrl = findSubtitleUrl(data);
      if (code === "pinedrama") {
        // Pinedrama quirk: language=id gives Indonesian subs but HEVC video;
        // language=in gives H264 video but only Chinese subs. Use H264 video
        // from `in`, then fetch subtitle from official Indonesian locale.
        const subData = await this.get<unknown>(playPath.replace("language=in", "language=id")).catch(() => null);
        subtitleUrl = findSubtitleUrl(subData) ?? subtitleUrl;
      }
      return { streamUrl: url, streamType: streamTypeFromUrl(url), subtitleUrl };
    }
  }

  return new CfgAdapter();
}
