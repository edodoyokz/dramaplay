import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { posterSrc } from "../lib/img";

type Drama = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  country: string | null;
  year: number | null;
  rating: number;
  episodeCount: number;
  provider?: { code: string; name: string };
};

type ProviderResponse = {
  provider: { code: string; name: string; logoUrl?: string | null };
  items: Drama[];
  page: number;
  limit: number;
  hasMore: boolean;
};

export default function ProviderDramas() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<ProviderResponse["provider"] | null>(null);
  const [items, setItems] = useState<Drama[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextPage: number) {
    setLoading(true);
    setError("");
    try {
      const res = await api<ProviderResponse>(`/catalog/providers/${code}/dramas?page=${nextPage}&limit=24`);
      setProvider(res.provider);
      setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items]));
      setPage(res.page);
      setHasMore(res.hasMore);
    } catch {
      setError(nextPage === 1 ? "Provider tidak ditemukan." : "Gagal memuat halaman berikutnya.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setItems([]);
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 pb-12">
      <header className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3 bg-black/60 backdrop-blur-md border-b border-zinc-900/60">
        <button 
          onClick={() => navigate(-1)} 
          className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-all duration-200" 
          aria-label="Kembali"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <ProviderLogo name={provider?.name ?? code} logoUrl={provider?.logoUrl} />
        <div>
          <p className="text-[10px] uppercase tracking-widest text-rose-400 font-bold">Provider</p>
          <h1 className="text-lg font-extrabold">{provider?.name ?? code}</h1>
        </div>
      </header>

      <main className="px-4 mt-5">
        {error && items.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-3">
          {items.map((d) => (
            <DramaCard key={d.id} drama={d} />
          ))}
        </div>

        {loading && <p className="py-6 text-center text-xs text-zinc-500">Memuat...</p>}

        {error && items.length > 0 ? (
          <button onClick={() => load(page + 1)} className="mt-5 w-full rounded-full border border-zinc-800 py-2 text-sm text-zinc-300">
            Coba lagi
          </button>
        ) : null}

        {!loading && hasMore ? (
          <button onClick={() => load(page + 1)} className="mt-6 w-full rounded-full bg-rose-500 py-2.5 text-sm font-bold text-white">
            Muat Lagi
          </button>
        ) : null}
      </main>
    </div>
  );
}

function ProviderLogo({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-extrabold text-rose-400">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function DramaCard({ drama: d }: { drama: Drama }) {
  return (
    <Link to={`/drama/${d.slug}`} className="block group">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800/80">
        {d.posterUrl ? <img src={posterSrc(d.posterUrl)} alt={d.title} className="h-full w-full object-cover" loading="lazy" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-1.5 left-1.5">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 text-rose-400 border border-rose-500/20">
            {d.episodeCount || 0} Eps
          </span>
        </div>
      </div>
      <h4 className="mt-2 truncate text-xs font-semibold text-zinc-300 group-hover:text-white">{d.title}</h4>
      <p className="text-[9px] text-zinc-500 mt-0.5">{d.year || "2026"} • {d.country || "ID"}</p>
    </Link>
  );
}
