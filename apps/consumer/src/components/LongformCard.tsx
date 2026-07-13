import { Link } from "react-router-dom";
import { posterSrc } from "../lib/img";
import { mediaTypeLabel, titlePath, watchPath } from "../lib/content-route";
import { resolveItemMediaType, type LongformCatalogItem } from "../lib/longform-provider";

export type LongformCardDrama = LongformCatalogItem & {
  id: string;
  slug: string;
  title: string;
  posterUrl?: string | null;
  country?: string | null;
  year?: number | null;
  genres?: string[] | null;
  rating?: number | null;
  episodeCount?: number | null;
  contentType?: string | null;
  mediaType?: string | null;
};

/**
 * Shared poster card for landing shelves and category grids.
 *
 * Series always links to detail (episode selection). A movie links to detail
 * by default and only direct-watch when a verified watch target is supplied.
 */
export function LongformCard({
  drama: d,
  watchSeason,
  watchEpisode,
}: {
  drama: LongformCardDrama;
  watchSeason?: number;
  watchEpisode?: number;
}) {
  const media = resolveItemMediaType(d);
  const label = mediaTypeLabel(media);
  const ct = d.contentType ?? "longform";

  // Direct-watch only for movies with an explicit, verified watch target.
  const to =
    media === "movie" && watchSeason != null && watchEpisode != null
      ? watchPath(d.slug, watchEpisode, ct, watchSeason)
      : titlePath(d.slug, ct);

  const metaBits = [d.year, d.country].filter((x): x is number | string => x != null && x !== 0);

  return (
    <Link to={to} className="block group">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800/80">
        {d.posterUrl ? (
          <img
            src={posterSrc(d.posterUrl)}
            alt={d.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-zinc-600">No Image</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
        {label ? (
          <span
            className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold border ${
              media === "movie"
                ? "bg-amber-500/20 text-amber-200 border-amber-400/30"
                : "bg-sky-500/20 text-sky-200 border-sky-400/30"
            }`}
          >
            {label}
          </span>
        ) : null}
        {media === "series" && (d.episodeCount ?? 0) > 0 ? (
          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/65 text-zinc-100 border border-white/10">
            {d.episodeCount} Eps
          </span>
        ) : null}
      </div>
      <h3 className="mt-2 truncate text-xs font-semibold text-zinc-300 group-hover:text-white">{d.title}</h3>
      {metaBits.length ? (
        <p className="text-[9px] text-zinc-500 mt-0.5">{metaBits.join(" • ")}</p>
      ) : null}
    </Link>
  );
}
