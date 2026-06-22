import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Episode {
  id: string;
  episodeNumber: number;
  title: string | null;
  accessType: "free" | "vip";
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
}
interface DetailResponse {
  drama: Drama;
  episodes: Episode[];
}

export default function DramaDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "episodes">("episodes");
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [lastWatchedEp, setLastWatchedEp] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;
    api<DetailResponse>(`/catalog/dramas/${slug}`)
      .then((res) => {
        setData(res);
        try {
          const stored = localStorage.getItem("dramaplay:watch_progress");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              const match = parsed.find(
                (p: { slug: string; episodeNumber: number }) => p.slug === slug
              );
              if (match) {
                setLastWatchedEp(match.episodeNumber);
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      })
      .catch(() => setData(null));
  }, [slug]);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center text-zinc-400">
        <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold tracking-wide">Memuat Drama...</p>
      </div>
    );
  }

  const { drama, episodes } = data;

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 pb-10">
      {/* Immersive Blurred Header Image */}
      <div className="relative w-full h-[260px] bg-zinc-950 overflow-hidden">
        {/* Blurred Backdrop */}
        <div className="absolute inset-0 filter blur-xl opacity-30 scale-110">
          <img 
            src={drama.posterUrl || ""} 
            alt="" 
            className="w-full h-full object-cover" 
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-black/40 to-black/60 z-10" />

        {/* Floating Controls */}
        <div className="absolute top-4 left-4 z-20">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md border border-zinc-800 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Center Poster + Details Overlay */}
        <div className="absolute bottom-4 left-0 w-full px-4 z-20 flex gap-4 items-end">
          <div className="w-24 shrink-0 aspect-[2/3] rounded-lg overflow-hidden border border-zinc-800 shadow-xl bg-zinc-900">
            <img 
              src={drama.posterUrl || ""} 
              alt={drama.title} 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 pb-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase">
                {drama.country || "Drama"}
              </span>
              {drama.rating && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                  ★ {drama.rating.toFixed(1)}
                </span>
              )}
            </div>
            <h1 className="text-lg font-extrabold text-white leading-tight line-clamp-2">
              {drama.title}
            </h1>
            <p className="text-[10px] text-zinc-400 mt-1">
              {drama.year || "2026"} • {episodes.length} Episode
            </p>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="px-4 mt-4">
        <Link
          to={`/drama/${drama.slug}/episode/${lastWatchedEp || episodes[0]?.episodeNumber || 1}`}
          className="w-full py-3 rounded-full bg-gradient-sunset text-white text-center font-bold text-sm tracking-wide shadow-lg shadow-rose-500/15 flex items-center justify-center gap-2 hover:opacity-95 transition-opacity active:scale-98 duration-100"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          {lastWatchedEp ? `Lanjut Nonton Ep ${lastWatchedEp}` : "Mulai Nonton Sekarang"}
        </Link>
      </div>

      {/* Tabs Layout */}
      <div className="px-4 mt-6 border-b border-zinc-900">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("episodes")}
            className={`pb-2.5 text-sm font-bold relative transition-colors duration-200 ${
              activeTab === "episodes" ? "text-rose-500" : "text-zinc-500"
            }`}
          >
            Episode ({episodes.length})
            {activeTab === "episodes" && (
              <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-rose-500 rounded-full" />
            )}
          </button>
          
          <button
            onClick={() => setActiveTab("info")}
            className={`pb-2.5 text-sm font-bold relative transition-colors duration-200 ${
              activeTab === "info" ? "text-rose-500" : "text-zinc-500"
            }`}
          >
            Tentang
            {activeTab === "info" && (
              <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-rose-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="px-4 mt-4">
        {activeTab === "info" ? (
          <div className="space-y-4 animate-fadeIn">
            {drama.synopsis && (
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Sinopsis</h3>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {showFullSynopsis || drama.synopsis.length <= 150 
                    ? drama.synopsis 
                    : `${drama.synopsis.slice(0, 150)}...`}
                  {drama.synopsis.length > 150 && (
                    <button 
                      onClick={() => setShowFullSynopsis(!showFullSynopsis)}
                      className="text-rose-500 font-bold ml-1 text-xs"
                    >
                      {showFullSynopsis ? "Sembunyikan" : "Selengkapnya"}
                    </button>
                  )}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-900/60">
              {drama.genres && drama.genres.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Genre</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {drama.genres.map((g) => (
                      <span key={g} className="px-2 py-0.5 rounded text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {drama.country && (
                <div>
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Asal</h4>
                  <p className="text-xs text-zinc-300 font-medium mt-1">{drama.country}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="animate-fadeIn">
            <div className="grid grid-cols-4 gap-2">
              {episodes.map((ep) => {
                const isWatched = lastWatchedEp !== null && ep.episodeNumber === lastWatchedEp;
                const isVip = ep.accessType === "vip";
                return (
                  <Link
                    key={ep.id}
                    to={`/drama/${drama.slug}/episode/${ep.episodeNumber}`}
                    className={`relative aspect-square rounded-xl flex flex-col items-center justify-center border transition-all duration-200 ${
                      isWatched 
                        ? "bg-rose-500/10 border-rose-500 text-rose-400 font-extrabold shadow-sm shadow-rose-500/10" 
                        : isVip 
                          ? "bg-amber-500/5 border-amber-500/30 text-amber-400/80 hover:border-amber-400"
                          : "bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <span className="text-base font-bold">{ep.episodeNumber}</span>
                    
                    {isVip ? (
                      <span className="absolute top-1 right-1">
                        <svg className="w-2.5 h-2.5 fill-current text-amber-400" viewBox="0 0 24 24">
                          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                        </svg>
                      </span>
                    ) : (
                      <span className="absolute bottom-1 text-[7px] tracking-wide font-extrabold text-zinc-500 uppercase">
                        FREE
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
