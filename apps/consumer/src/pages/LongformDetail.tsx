import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { mediaTypeLabel, watchPath } from "../lib/content-route";
import { posterSrc } from "../lib/img";
import { getProgressForSlug } from "../lib/local-engagement";
import { SeoHead } from "../lib/seo";

interface Episode {
  id: string;
  episodeNumber: number;
  title: string | null;
  accessType: "free" | "vip";
  durationSeconds?: number | null;
}

interface Drama {
  id: string;
  slug: string;
  title: string;
  synopsis: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  year: number | null;
  genres: string[] | null;
  country: string | null;
  rating: number | null;
  contentType?: "shortform" | "longform";
  mediaType?: "movie" | "series";
  provider?: { code: string; name: string; contentType?: string };
}

interface DetailResponse {
  drama: Drama;
  episodes: Episode[];
}

export default function LongformDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastWatchedEp, setLastWatchedEp] = useState<number | null>(null);

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }

  function load() {
    if (!slug) return;
    setLoading(true);
    setError(false);
    api<DetailResponse>(`/catalog/dramas/${slug}`)
      .then((res) => {
        setData(res);
        const match = getProgressForSlug(slug);
        if (match) setLastWatchedEp(match.episodeNumber);
      })
      .catch(() => {
        setData(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center text-zinc-400">
        <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide">Memuat Film/Serial...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center text-zinc-300 px-6 text-center">
        <p className="text-sm font-semibold">Gagal memuat judul</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={load} className="rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-white">
            Coba Lagi
          </button>
          <button type="button" onClick={goBack} className="rounded-full border border-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const { drama, episodes } = data;
  const label = mediaTypeLabel(drama.mediaType) ?? "Film & Serial";
  const startEpisode = lastWatchedEp || episodes[0]?.episodeNumber;
  const hero = drama.backdropUrl || drama.posterUrl;

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 pb-12">
      <SeoHead
        title={drama.title}
        description={drama.synopsis || `Nonton ${drama.title} di Dramaplay.`}
        canonical={`https://dramaplay.my.id/title/${drama.slug}`}
        ogImage={drama.posterUrl ? posterSrc(drama.posterUrl) : undefined}
      />

      <div className="relative w-full h-[220px] bg-zinc-950 overflow-hidden">
        {hero ? <img src={posterSrc(hero)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-black/50 to-black/70" />
        <button
          type="button"
          onClick={goBack}
          aria-label="Kembali"
          className="absolute top-4 left-4 z-20 w-11 h-11 rounded-full bg-black/55 border border-zinc-800 flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div className="px-4 -mt-16 relative z-10 flex gap-4">
        <div className="w-28 shrink-0 aspect-[2/3] rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-xl">
          {drama.posterUrl ? <img src={posterSrc(drama.posterUrl)} alt={drama.title} className="w-full h-full object-cover" /> : null}
        </div>
        <div className="flex-1 pt-16">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-sky-500/15 text-sky-300 border border-sky-400/20">
              {label}
            </span>
            {drama.provider ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-zinc-900 text-zinc-300 border border-zinc-800">
                {drama.provider.name}
              </span>
            ) : null}
          </div>
          <h1 className="text-xl font-extrabold text-white leading-tight">{drama.title}</h1>
          <p className="text-[11px] text-zinc-400 mt-1">
            {[drama.year, drama.country, drama.mediaType === "movie" ? "Film" : `${episodes.length} Episode`]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>
      </div>

      <div className="px-4 mt-5">
        {episodes.length === 0 || !startEpisode ? (
          <div className="w-full py-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-center font-bold text-sm">
            Konten belum tersedia
          </div>
        ) : (
          <Link
            to={watchPath(drama.slug, startEpisode, "longform")}
            className="w-full py-3 rounded-full bg-gradient-sunset text-white text-center font-bold text-sm tracking-wide shadow-lg shadow-rose-500/15 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            {drama.mediaType === "movie"
              ? "Tonton Film"
              : lastWatchedEp
                ? `Lanjut Episode ${lastWatchedEp}`
                : "Mulai Nonton"}
          </Link>
        )}
      </div>

      {drama.synopsis ? (
        <div className="px-4 mt-6">
          <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Sinopsis</h2>
          <p className="text-sm text-zinc-300 leading-relaxed">{drama.synopsis}</p>
        </div>
      ) : null}

      {drama.genres && drama.genres.length > 0 ? (
        <div className="px-4 mt-4 flex flex-wrap gap-1.5">
          {drama.genres.map((g) => (
            <span key={g} className="px-2 py-0.5 rounded text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400">
              {g}
            </span>
          ))}
        </div>
      ) : null}

      {drama.mediaType !== "movie" ? (
        <div className="px-4 mt-6">
          <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Episode</h2>
          <div className="grid grid-cols-4 gap-2">
            {episodes.map((ep) => (
              <Link
                key={ep.id}
                to={watchPath(drama.slug, ep.episodeNumber, "longform")}
                className={`rounded-xl border px-2 py-3 text-center text-xs font-bold ${
                  ep.accessType === "vip"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border-zinc-800 bg-zinc-900 text-zinc-200"
                }`}
              >
                {ep.episodeNumber}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
