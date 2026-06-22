import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Drama {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  country: string | null;
  year: number | null;
  rating?: number;
  episodeCount?: number;
}

const POPULAR_SUGGESTIONS = [
  "Romantis",
  "Laga",
  "Thriller",
  "Komedi",
  "Perselingkuhan",
  "CEO",
  "Nikah Kontrak",
  "Balas Dendam"
];

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [results, setResults] = useState<Drama[]>([]);
  const [busy, setBusy] = useState(false);

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ items: Drama[] }>(
        `/catalog/search?q=${encodeURIComponent(query)}`
      );
      setResults(data.items);
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      doSearch(q);
    }, 150);
    return () => clearTimeout(timer);
  }, [q, doSearch]);

  const selectTag = (tag: string) => {
    setSearchParams({ q: tag });
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 pb-10">
      {/* Sticky Search Header */}
      <div className="sticky top-0 z-40 bg-black/65 backdrop-blur-md px-4 py-3 border-b border-zinc-900/60">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Cari judul drama atau genre..."
              value={q}
              onChange={(e) => setSearchParams({ q: e.target.value })}
              autoFocus
              className="w-full glass-input rounded-full pl-10 pr-4 py-2.5 text-xs text-white"
            />
            <span className="absolute left-3.5 top-3 text-zinc-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            {q && (
              <button 
                onClick={() => setSearchParams({})}
                className="absolute right-3 top-2.5 p-0.5 rounded-full bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {busy ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <div className="w-8 h-8 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-3"></div>
            <p className="text-xs tracking-wider">Mencari drama terbaik...</p>
          </div>
        ) : q.trim() === "" ? (
          /* Search Suggestions Panel */
          <div className="animate-fadeIn">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">
              Pencarian Terpopuler
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {POPULAR_SUGGESTIONS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => selectTag(tag)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-850 active:scale-95 duration-100 transition-all"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          /* Empty Search Result */
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-zinc-300">Hasil Tidak Ditemukan</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs leading-relaxed">
              Kami tidak dapat menemukan drama dengan kata kunci "{q}". Coba cari kata kunci lain seperti "CEO" atau "Nikah".
            </p>
          </div>
        ) : (
          /* Search Result Grid */
          <div className="animate-fadeIn">
            <p className="text-xs text-zinc-500 mb-4">Menampilkan {results.length} hasil untuk "{q}"</p>
            <div className="grid grid-cols-3 gap-3">
              {results.map((d) => (
                <Link key={d.id} to={`/drama/${d.slug}`} className="block group">
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-100" />
                    
                    {d.rating && d.rating > 0 ? (
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-black/60 backdrop-blur-md text-amber-400 flex items-center gap-0.5 border border-amber-400/20">
                        ★ {d.rating.toFixed(1)}
                      </span>
                    ) : null}

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
          </div>
        )}
      </div>
    </div>
  );
}
