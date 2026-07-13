export type LongformFilter = "all" | "movie" | "series";

export type LongformCatalogItem = {
  id: string;
  mediaType?: "movie" | "series" | string | null;
  episodeCount?: number | null;
  posterUrl?: string | null;
  year?: number | null;
  title?: string;
};

export function isLongformProviderCode(code?: string | null): boolean {
  const c = (code ?? "").toLowerCase();
  return c === "wetv" || c === "moviebox";
}

/** Infer film vs serial when metadata is missing. */
export function resolveItemMediaType(
  item: Pick<LongformCatalogItem, "mediaType" | "episodeCount">,
): "movie" | "series" {
  if (item.mediaType === "movie" || item.mediaType === "series") return item.mediaType;
  return (item.episodeCount ?? 0) > 1 ? "series" : "movie";
}

export function partitionLongformItems<T extends LongformCatalogItem>(items: T[]) {
  const movies: T[] = [];
  const series: T[] = [];
  for (const item of items) {
    if (resolveItemMediaType(item) === "movie") movies.push(item);
    else series.push(item);
  }
  return { movies, series };
}

export function filterLongformItems<T extends LongformCatalogItem>(
  items: T[],
  filter: LongformFilter,
): T[] {
  if (filter === "all") return items;
  return items.filter((item) => resolveItemMediaType(item) === filter);
}

export function longformProviderTheme(code: string): {
  accent: string;
  accentSoft: string;
  chip: string;
  label: string;
  blurb: string;
} {
  if (code === "moviebox") {
    return {
      accent: "from-amber-500 to-orange-600",
      accentSoft: "bg-amber-500/15 text-amber-300 border-amber-400/25",
      chip: "bg-amber-500 text-black",
      label: "MovieBox",
      blurb: "Film & serial pilihan — layar lebar, siap ditonton.",
    };
  }
  return {
    accent: "from-sky-500 to-indigo-600",
    accentSoft: "bg-sky-500/15 text-sky-300 border-sky-400/25",
    chip: "bg-sky-500 text-white",
    label: "WeTV",
    blurb: "Drama Asia, film, dan serial — dikelompokkan biar gampang pilih.",
  };
}

export function pickFeaturedItems<T extends LongformCatalogItem>(items: T[], limit = 6): T[] {
  return items
    .filter((i) => i.posterUrl)
    .slice()
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.episodeCount ?? 0) - (a.episodeCount ?? 0))
    .slice(0, limit);
}

/** Route to a provider category page. */
export function categoryPath(providerCode: string, categoryCode: string): string {
  return `/provider/${providerCode}/category/${categoryCode}`;
}

/** Category route with optional media filter. `all` (or invalid) omits the
 *  query so the API never receives an unsupported `type` value. */
export function categoryUrl(
  providerCode: string,
  categoryCode: string,
  filter: LongformFilter = "all",
): string {
  const base = categoryPath(providerCode, categoryCode);
  if (filter === "movie" || filter === "series") return `${base}?type=${filter}`;
  return base;
}

/** API path for the provider landing endpoint. */
export function landingApiPath(providerCode: string): string {
  return `/catalog/providers/${providerCode}/landing`;
}

/** API path for a category page with page + optional media filter. */
export function categoryApiPath(
  providerCode: string,
  categoryCode: string,
  page: number,
  filter: LongformFilter = "all",
  limit = 48,
): string {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filter === "movie" || filter === "series") params.set("type", filter);
  return `/catalog/providers/${providerCode}/categories/${categoryCode}?${params}`;
}
