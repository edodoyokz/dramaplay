import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";

interface Drama {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  country: string | null;
  year: number | null;
  genres: string[];
  rating: number;
  episodeCount: number;
}

interface WatchProgress {
  slug: string;
  title: string;
  posterUrl: string | null;
  episodeNumber: number;
  percent: number;
}

const GENRES = ["Semua", "Romantis", "Drama", "Komedi", "Thriller", "Laga"];

export default function Home() {
  const navigate = useNavigate();
  const [trending, setTrending] = useState<Drama[]>([]);
  const [fresh, setFresh] = useState<Drama[]>([]);
  const [selectedGenre, setSelectedGenre] = useState("Semua");
  const [progressList] = useState<WatchProgress[]>(() => {
    try {
      const stored = localStorage.getItem("dramaplay:watch_progress");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, 5);
        }
      }
    } catch (e) {
      console.error("Failed to parse watch progress", e);
    }
    return [];
  });
  const [userVip, setUserVip] = useState(false);

  useEffect(() => {
    // Fetch data
    api<{ items: Drama[] }>("/catalog/trending")
      .then((r) => setTrending(r.items))
      .catch(() => setTrending([]));
    
    api<{ items: Drama[] }>("/catalog/new")
      .then((r) => setFresh(r.items))
      .catch(() => setFresh([]));

    // Check VIP state
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      api<{ user: { isVip: boolean } }>("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res?.user) setUserVip(res.user.isVip);
        })
        .catch(() => {});
    });
  }, []);

  // Filter items based on selected genre
  const filterDramas = (items: Drama[]) => {
    if (selectedGenre === "Semua") return items;
    return items.filter((d) => 
      d.genres?.some((g) => g.toLowerCase().includes(selectedGenre.toLowerCase()))
    );
  };

  const heroDrama = trending[0];
  const filteredTrending = filterDramas(trending);
  const filteredFresh = filterDramas(fresh);

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 pb-12">
      {/* Immersive Glass Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-md border-b border-zinc-900/60">
        <div className="flex items-center gap-2" onClick={() => navigate("/")}>
          <div className="w-8 h-8 rounded-lg bg-gradient-sunset flex items-center justify-center glow-sunset">
            <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-gradient-sunset">
            Dramaplay
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {userVip ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-gold text-zinc-950 uppercase tracking-wider glow-gold">
              VIP PRO
            </span>
          ) : (
            <Link 
              to="/profile" 
              className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-900 border border-zinc-800 text-amber-400 hover:border-amber-400/50 transition-colors"
            >
              VIP
            </Link>
          )}
          <Link to="/search" className="p-1 text-zinc-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>
        </div>
      </header>

      {/* Featured Hero Banner */}
      {heroDrama && selectedGenre === "Semua" && (
        <div className="relative w-full h-[380px] overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[#030303]/90 z-10" />
          <img 
            src={heroDrama.backdropUrl || heroDrama.posterUrl || ""} 
            alt={heroDrama.title} 
            className="w-full h-full object-cover transform scale-100 group-hover:scale-105 transition-transform duration-700" 
          />
          <div className="absolute bottom-6 left-0 w-full px-4 z-20 flex flex-col items-center text-center">
            <span className="px-2 py-0.5 mb-2 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold tracking-wider uppercase border border-rose-500/30">
              🔥 Sedang Populer
            </span>
            <h2 className="text-2xl font-extrabold text-white tracking-tight drop-shadow-md max-w-xs">
              {heroDrama.title}
            </h2>
            <div className="flex items-center gap-2 mt-2 text-xs text-zinc-400">
              <span className="flex items-center gap-0.5 text-amber-400 font-medium">
                ★ {heroDrama.rating || "9.0"}
              </span>
              <span>•</span>
              <span>{heroDrama.year || "2026"}</span>
              <span>•</span>
              <span>{heroDrama.country || "ID"}</span>
            </div>
            
            <Link 
              to={`/drama/${heroDrama.slug}/episode/1`}
              className="mt-4 flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-gradient-sunset text-white font-bold text-sm tracking-wide hover:opacity-95 transition-opacity shadow-lg shadow-rose-500/20 active:scale-95 duration-100"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Mulai Nonton
            </Link>
          </div>
        </div>
      )}

      {/* Genre Categories Filter Carousel */}
      <div className="px-4 mt-6">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 border ${
                selectedGenre === genre
                  ? "bg-rose-500 text-white border-rose-500 glow-sunset"
                  : "bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:text-zinc-200"
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Continue Watching Section */}
      {progressList.length > 0 && selectedGenre === "Semua" && (
        <section className="mt-8 px-4">
          <h3 className="text-md font-bold text-white mb-3 tracking-wide flex items-center gap-1.5">
            <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Lanjutkan Menonton
          </h3>
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
            {progressList.map((progress) => (
              <Link 
                key={progress.slug} 
                to={`/drama/${progress.slug}/episode/${progress.episodeNumber}`}
                className="relative block w-36 shrink-0 glass-card rounded-xl overflow-hidden"
              >
                <div className="aspect-[16/9] w-full relative bg-zinc-900">
                  {progress.posterUrl && (
                    <img 
                      src={progress.posterUrl} 
                      alt={progress.title} 
                      className="w-full h-full object-cover object-center" 
                    />
                  )}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-rose-500/80 flex items-center justify-center text-white">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-zinc-800">
                    <div 
                      className="h-full bg-gradient-sunset" 
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
                <div className="p-2">
                  <h4 className="text-[11px] font-semibold text-white truncate">
                    {progress.title}
                  </h4>
                  <p className="text-[9px] text-zinc-400 mt-0.5">
                    Episode {progress.episodeNumber}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Grid Catalog */}
      <div className="mt-8 px-4 space-y-8">
        <Section title="Trending Sekarang" items={filteredTrending} />
        <Section title="Drama Terbaru" items={filteredFresh} />
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: Drama[] }) {
  if (items.length === 0) return null;
  
  return (
    <section className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-md font-bold text-white tracking-wide">{title}</h3>
        <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
          Lihat Semua
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        {items.map((d) => (
          <Link 
            key={d.id} 
            to={`/drama/${d.slug}`} 
            className="block group"
          >
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800/80 shadow-md group-hover:border-rose-500/30 transition-all duration-300">
              {d.posterUrl ? (
                <img
                  src={d.posterUrl}
                  alt={d.title}
                  className="h-full w-full object-cover transform scale-100 group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                  <span className="text-[10px] text-zinc-500">No Image</span>
                </div>
              )}
              
              {/* Bottom Fading Shadow */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-100 transition-opacity" />
              
              {/* Top-Right Badge (Simulated VIP) */}
              <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 items-end">
                {d.rating && d.rating > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-black/60 backdrop-blur-md text-amber-400 flex items-center gap-0.5 border border-amber-400/20">
                    ★ {d.rating.toFixed(1)}
                  </span>
                ) : null}
              </div>

              {/* Episode Count Indicator */}
              <div className="absolute bottom-1.5 left-1.5">
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 backdrop-blur-md text-rose-400 border border-rose-500/20">
                  {d.episodeCount || 10} Eps
                </span>
              </div>
            </div>
            
            <div className="mt-2 px-0.5">
              <h4 className="truncate text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors duration-200">
                {d.title}
              </h4>
              <p className="text-[9px] text-zinc-500 mt-0.5">
                {d.year || "2026"} • {d.country || "ID"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
