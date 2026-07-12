import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { posterSrc } from "../lib/img";
import { mediaTypeLabel, titlePath } from "../lib/content-route";
import {
  filterLongformItems,
  isLongformProviderCode,
  longformProviderTheme,
  partitionLongformItems,
  pickFeaturedItems,
  resolveItemMediaType,
  type LongformFilter,
} from "../lib/longform-provider";

type Drama = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  country: string | null;
  year: number | null;
  rating: number;
  episodeCount: number;
  contentType?: "shortform" | "longform";
  mediaType?: "movie" | "series";
};

type ProviderResponse = {
  provider: { code: string; name: string; logoUrl?: string | null; contentType?: string };
  items: Drama[];
  page: number;
  limit: number;
  hasMore: boolean;
};

const PAGE_LIMIT = 48;

export default function LongformProvider() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const theme = longformProviderTheme(code.toLowerCase());

  const [provider, setProvider] = useState<ProviderResponse["provider"] | null>(null);
  const [items, setItems] = useState<Drama[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<LongformFilter>("all");

  async function load(nextPage: number) {
    setLoading(true);
    setError("");
    try {
      const res = await api<ProviderResponse>(
        `/catalog/providers/${code}/dramas?page=${nextPage}&limit=${PAGE_LIMIT}`,
      );
      if (!isLongformProviderCode(res.provider.code) && res.provider.contentType !== "longform") {
        navigate(`/provider/${code}`, { replace: true });
        return;
      }
      setProvider(res.provider);
      setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items]));
      setPage(res.page);
      setHasMore(res.hasMore);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.startsWith("404")) setError("Provider tidak ditemukan.");
      else if (nextPage === 1) setError("Gagal memuat katalog.");
      else setError("Gagal memuat halaman berikutnya.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Parent route always supplies :code; empty code is a programming error.
    if (!code || !isLongformProviderCode(code)) return;
    setItems([]);
    setPage(1);
    setFilter("all");
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const { movies, series } = useMemo(() => partitionLongformItems(items), [items]);
  const visible = useMemo(() => filterLongformItems(items, filter), [items, filter]);
  const featured = useMemo(() => pickFeaturedItems(visible, 8), [visible]);
  const hero = featured[0] ?? visible[0] ?? null;

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 pb-16">
      <header className="relative overflow-hidden border-b border-zinc-900/80">
        {hero?.posterUrl ? (
          <img
            src={posterSrc(hero.posterUrl)}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-30 blur-sm scale-110"
          />
        ) : null}
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.accent} opacity-25`} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/80 to-black/40" />

        <div className="relative px-4 pt-3 pb-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-zinc-200"
              aria-label="Kembali"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <ProviderLogo name={provider?.name ?? theme.label} logoUrl={provider?.logoUrl} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/70 font-bold">Film & Serial</p>
              <h1 className="text-xl font-extrabold truncate">{provider?.name ?? theme.label}</h1>
            </div>
          </div>

          <p className="mt-3 text-sm text-zinc-300 max-w-md">{theme.blurb}</p>

          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            <StatChip label="Judul" value={items.length + (hasMore ? "+" : "")} />
            <StatChip label="Film" value={movies.length} />
            <StatChip label="Serial" value={series.length} />
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-40 px-4 py-3 bg-[#030303]/90 backdrop-blur-md border-b border-zinc-900/70">
        <div className="flex gap-2">
          {(
            [
              ["all", "Semua", items.length],
              ["movie", "Film", movies.length],
              ["series", "Serial", series.length],
            ] as const
          ).map(([key, label, count]) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`min-h-10 rounded-full px-3.5 text-xs font-bold border transition-colors ${
                  active
                    ? `${theme.chip} border-transparent`
                    : "bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-600"
                }`}
              >
                {label}
                <span className={`ml-1.5 ${active ? "opacity-80" : "text-zinc-500"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="px-4 mt-5 space-y-7">
        {error && items.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
            <p>{error}</p>
            {!error.includes("tidak ditemukan") ? (
              <button
                type="button"
                onClick={() => load(1)}
                className="mt-3 rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-white"
              >
                Coba Lagi
              </button>
            ) : null}
          </div>
        ) : null}

        {featured.length > 1 ? (
          <section>
            <SectionHead title="Sorotan" subtitle="Pilihan dari filter aktif" />
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
              {featured.map((d) => (
                <FeaturedCard key={d.id} drama={d} />
              ))}
            </div>
          </section>
        ) : null}

        {filter === "all" ? (
          <>
            <MediaSection
              title="Serial"
              subtitle={`${series.length} judul`}
              empty="Belum ada serial di batch ini."
              items={series}
              onShowAll={() => setFilter("series")}
            />
            <MediaSection
              title="Film"
              subtitle={`${movies.length} judul`}
              empty="Belum ada film di batch ini."
              items={movies}
              onShowAll={() => setFilter("movie")}
            />
          </>
        ) : (
          <section>
            <SectionHead
              title={filter === "movie" ? "Film" : "Serial"}
              subtitle={`${visible.length} judul`}
            />
            <TitleGrid items={visible} />
            {!loading && visible.length === 0 ? (
              <EmptyBox text={`Belum ada ${filter === "movie" ? "film" : "serial"} di halaman ini.`} />
            ) : null}
          </section>
        )}

        {loading ? <p className="py-4 text-center text-xs text-zinc-500">Memuat…</p> : null}

        {error && items.length > 0 ? (
          <button
            type="button"
            onClick={() => load(page + 1)}
            className="w-full rounded-full border border-zinc-800 py-2.5 text-sm text-zinc-300"
          >
            Coba lagi
          </button>
        ) : null}

        {!loading && hasMore ? (
          <button
            type="button"
            onClick={() => load(page + 1)}
            className={`w-full rounded-full py-3 text-sm font-bold text-white bg-gradient-to-r ${theme.accent}`}
          >
            Muat Lebih Banyak
          </button>
        ) : null}
      </main>
    </div>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <h2 className="text-base font-extrabold tracking-wide">{title}</h2>
      {subtitle ? <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{subtitle}</p> : null}
    </div>
  );
}

function MediaSection({
  title,
  subtitle,
  empty,
  items,
  onShowAll,
}: {
  title: string;
  subtitle: string;
  empty: string;
  items: Drama[];
  onShowAll: () => void;
}) {
  if (items.length === 0) {
    return (
      <section>
        <SectionHead title={title} subtitle={subtitle} />
        <EmptyBox text={empty} />
      </section>
    );
  }
  const preview = items.slice(0, 9);
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold tracking-wide">{title}</h2>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{subtitle}</p>
        </div>
        {items.length > 9 ? (
          <button
            type="button"
            onClick={onShowAll}
            className="text-[10px] font-bold uppercase tracking-widest text-rose-400"
          >
            Semua
          </button>
        ) : null}
      </div>
      <TitleGrid items={preview} />
    </section>
  );
}

function TitleGrid({ items }: { items: Drama[] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((d) => (
        <TitleCard key={d.id} drama={d} />
      ))}
    </div>
  );
}

function TitleCard({ drama: d }: { drama: Drama }) {
  const media = resolveItemMediaType(d);
  const label = mediaTypeLabel(media);
  return (
    <Link to={titlePath(d.slug, d.contentType ?? "longform")} className="block group">
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
        {media === "series" && d.episodeCount > 0 ? (
          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/65 text-zinc-100 border border-white/10">
            {d.episodeCount} Eps
          </span>
        ) : null}
      </div>
      <h3 className="mt-2 truncate text-xs font-semibold text-zinc-300 group-hover:text-white">{d.title}</h3>
      {d.year || d.country ? (
        <p className="text-[9px] text-zinc-500 mt-0.5">{[d.year, d.country].filter(Boolean).join(" • ")}</p>
      ) : null}
    </Link>
  );
}

function FeaturedCard({ drama: d }: { drama: Drama }) {
  const media = resolveItemMediaType(d);
  return (
    <Link
      to={titlePath(d.slug, d.contentType ?? "longform")}
      className="snap-start shrink-0 w-[42%] max-w-[170px] block group"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-lg shadow-black/40">
        {d.posterUrl ? (
          <img src={posterSrc(d.posterUrl)} alt={d.title} className="h-full w-full object-cover" loading="lazy" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">
            {mediaTypeLabel(media)}
          </span>
          <p className="text-sm font-bold leading-snug line-clamp-2">{d.title}</p>
        </div>
      </div>
    </Link>
  );
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-2.5 py-1">
      <span className="text-zinc-400">{label}</span>
      <span className="font-extrabold text-white">{value}</span>
    </span>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-8 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}

function ProviderLogo({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return (
    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center">
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-extrabold text-white">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}
