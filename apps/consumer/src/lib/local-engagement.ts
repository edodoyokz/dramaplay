/**
 * Client-only engagement store (localStorage).
 * DB tables in packages/db/src/schema/engagement.ts exist but are unused —
 * wire those only when cross-device sync is actually needed.
 */

export type WatchProgressItem = {
  slug: string;
  title?: string;
  posterUrl?: string | null;
  seasonNumber?: number;
  episodeNumber: number;
  percent?: number;
};

const KEYS = {
  progress: "dramaplay:watch_progress",
  likes: "dramaplay:likes",
  favorites: "dramaplay:favorites",
} as const;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getWatchProgress(): WatchProgressItem[] {
  const list = readJson<unknown>(KEYS.progress, []);
  return Array.isArray(list) ? (list as WatchProgressItem[]) : [];
}

export function upsertWatchProgress(
  item: WatchProgressItem,
  limit = 10,
): WatchProgressItem[] {
  const next = [
    item,
    ...getWatchProgress().filter((p) => p.slug !== item.slug),
  ].slice(0, limit);
  writeJson(KEYS.progress, next);
  return next;
}

export function getProgressForSlug(slug: string): WatchProgressItem | undefined {
  return getWatchProgress().find((p) => p.slug === slug);
}

/** Keys like `${slug}-${episodeNumber}` */
export function getLikes(): string[] {
  const list = readJson<unknown>(KEYS.likes, []);
  return Array.isArray(list) ? list.map(String) : [];
}

export function isLiked(slug: string, episodeNumber: number | string): boolean {
  return getLikes().includes(`${slug}-${episodeNumber}`);
}

export function toggleLike(slug: string, episodeNumber: number | string): boolean {
  const key = `${slug}-${episodeNumber}`;
  const likes = getLikes();
  const on = !likes.includes(key);
  writeJson(KEYS.likes, on ? [...likes, key] : likes.filter((k) => k !== key));
  return on;
}

/** Drama slugs */
export function getFavorites(): string[] {
  const list = readJson<unknown>(KEYS.favorites, []);
  return Array.isArray(list) ? list.map(String) : [];
}

export function isFavorited(slug: string): boolean {
  return getFavorites().includes(slug);
}

export function toggleFavorite(slug: string): boolean {
  const favs = getFavorites();
  const on = !favs.includes(slug);
  writeJson(KEYS.favorites, on ? [...favs, slug] : favs.filter((s) => s !== slug));
  return on;
}
