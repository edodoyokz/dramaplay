import { BaseProviderAdapter } from "../base";
import type { ProviderStreamSource } from "@dramaplay/shared";

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
