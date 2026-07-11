import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { posterSrc } from "../lib/img";
import { SeoHead } from "../lib/seo";

interface Drama {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  country: string | null;
  year: number | null;
  rating?: number;
  episodeCount?: number;
  provider?: { code: string; name: string };
}

interface ProviderChip {
  code: string;
  name: string;
  logoUrl?: string | null;
}

interface SearchResponse {
  items: Drama[];
  page: number;
  limit: number;
  hasMore: boolean;
  provider?: { code: string; name: string };
}

const POPULAR_SUGGESTIONS = ["Romantis", "Laga", "Thriller", "Komedi", "Perselingkuhan", "CEO", "Nikah Kontrak", "Balas Dendam"];
const LIMIT = 24;

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const provider = searchParams.get("provider") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const [providers, setProviders] = useState<ProviderChip[]>([]);
  const [results, setResults] = useState<Drama[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ providers: ProviderChip[] }>("/catalog/home")
      .then((r) => setProviders(r.providers))
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setHasMore(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setBusy(true);
      const params = new URLSearchParams({ q: query, page: String(page), limit: String(LIMIT) });
      if (provider) params.set("provider", provider);

      api<SearchResponse>(`/catalog/search?${params.toString()}`)
        .then((data) => {
          if (cancelled) return;
          setResults((prev) => (page === 1 ? data.items : [...prev, ...data.items]));
          setHasMore(data.hasMore);
        })
        .catch(() => {
          if (cancelled) return;
          if (page === 1) setResults([]);
          setHasMore(false);
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });

    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, provider, page]);

  const setQuery = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("q", value);
    else next.delete("q");
    next.delete("page");
    setSearchParams(next);
  };

  const selectProvider = (code: string) => {
    const next = new URLSearchParams(searchParams);
    if (code) next.set("provider", code);
    else next.delete("provider");
    next.delete("page");
    setSearchParams(next);
  };

  const selectTag = (tag: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("q", tag);
    next.delete("page");
    setSearchParams(next);
  };

  const loadMore = () => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page + 1));
    setSearchParams(next);
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 pb-10">
      <SeoHead title="Cari Drama" noindex />
      <div className="sticky top-0 z-40 bg-black/65 backdrop-blur-md px-4 py-3 border-b border-zinc-900/60">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
            aria-label="Kembali"
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
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full glass-input rounded-full pl-10 pr-4 py-2.5 text-xs text-white"
            />
            <span className="absolute left-3.5 top-3 text-zinc-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            {q && (
              <button onClick={() => setSearchParams({})} className="absolute right-3 top-2.5 p-0.5 rounded-full bg-zinc-800 text-zinc-400 hover:text-white" aria-label="Bersihkan pencarian">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <ProviderChipButton active={!provider} label="Semua" onClick={() => selectProvider("")} />
          {providers.map((p) => (
            <ProviderChipButton key={p.code} active={provider === p.code} label={p.name} logoUrl={p.logoUrl} onClick={() => selectProvider(p.code)} />
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {q.trim() === "" ? (
          <div className="animate-fadeIn">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Pencarian Terpopuler</h3>
            <div className="flex flex-wrap gap-2.5">
              {POPULAR_SUGGESTIONS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => selectTag(tag)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-700 active:scale-95 duration-100 transition-all"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        ) : q.trim().length < 2 ? (
          <EmptyMessage title="Minimal 2 karakter" text="Ketik sedikitnya 2 karakter agar pencarian tidak membebani server." />
        ) : busy && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <div className="w-8 h-8 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-3" />
            <p className="text-xs tracking-wider">Mencari drama...</p>
          </div>
        ) : results.length === 0 ? (
          <EmptyMessage title="Hasil Tidak Ditemukan" text={`Tidak ada drama untuk "${q}"${provider ? " di provider ini" : ""}.`} />
        ) : (
          <div className="animate-fadeIn">
            <p className="text-xs text-zinc-500 mb-4">
              Menampilkan {results.length} hasil untuk "{q}"{provider ? ` di ${providers.find((p) => p.code === provider)?.name ?? provider}` : ""}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {results.map((d) => (
                <DramaCard key={d.id} drama={d} />
              ))}
            </div>
            {busy ? <p className="py-5 text-center text-xs text-zinc-500">Memuat...</p> : null}
            {!busy && hasMore ? (
              <button onClick={loadMore} className="mt-6 w-full rounded-full bg-rose-500 py-2.5 text-sm font-bold text-white">
                Muat Lagi
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderChipButton({ active, label, logoUrl, onClick }: { active: boolean; label: string; logoUrl?: string | null; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
        active ? "border-rose-500 bg-rose-500 text-white" : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:text-white"
      }`}
    >
      {logoUrl ? <img src={logoUrl} alt="" className="h-4 w-4 rounded-full object-cover" /> : null}
      {label}
    </button>
  );
}

function EmptyMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fadeIn">
      <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <h3 className="text-sm font-bold text-zinc-300">{title}</h3>
      <p className="text-xs text-zinc-500 mt-1 max-w-xs leading-relaxed">{text}</p>
    </div>
  );
}

function DramaCard({ drama: d }: { drama: Drama }) {
  return (
    <Link key={d.id} to={`/drama/${d.slug}`} className="block group">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800/80 shadow-md group-hover:border-rose-500/30 transition-all duration-300">
        {d.posterUrl ? (
          <img src={posterSrc(d.posterUrl)} alt={d.title} className="h-full w-full object-cover transform scale-100 group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
            <span className="text-[10px] text-zinc-500">No Image</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-100" />
        {d.provider ? (
          <span className="absolute top-1.5 left-1.5 max-w-[80%] truncate px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-black/65 backdrop-blur-md text-rose-300 border border-rose-500/20">
            {d.provider.name}
          </span>
        ) : null}
        {d.rating && d.rating > 0 ? (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-black/60 backdrop-blur-md text-amber-400 flex items-center gap-0.5 border border-amber-400/20">
            ★ {d.rating.toFixed(1)}
          </span>
        ) : null}
        <div className="absolute bottom-1.5 left-1.5">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 backdrop-blur-md text-rose-400 border border-rose-500/20">
            {d.episodeCount || 0} Eps
          </span>
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <h4 className="truncate text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors duration-200">{d.title}</h4>
        <p className="text-[9px] text-zinc-500 mt-0.5">{d.year || "2026"} • {d.country || "ID"}</p>
      </div>
    </Link>
  );
}
