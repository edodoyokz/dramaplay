import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

interface Drama {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  country: string | null;
  year: number | null;
}

export default function Search() {
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
        `/catalog/search?q=${encodeURIComponent(query)}`,
      );
      setResults(data.items);
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    doSearch(q);
  }, [q, doSearch]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="sticky top-0 z-10 bg-slate-950 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-slate-400">
            ←
          </Link>
          <input
            type="text"
            placeholder="Cari drama..."
            value={q}
            onChange={(e) => setSearchParams({ q: e.target.value })}
            autoFocus
            className="flex-1 rounded-xl bg-slate-800 px-4 py-2 text-sm focus:outline-none"
          />
        </div>
      </div>
      <div className="px-4 py-4">
        {busy ? (
          <p className="text-slate-400">Mencari...</p>
        ) : results.length === 0 && q.trim() ? (
          <p className="text-slate-400">Tidak ada hasil untuk "{q}"</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {results.map((d) => (
              <Link key={d.id} to={`/drama/${d.slug}`} className="block">
                <div className="aspect-[2/3] overflow-hidden rounded-lg bg-slate-800">
                  {d.posterUrl ? (
                    <img
                      src={d.posterUrl}
                      alt={d.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="mt-1 truncate text-xs text-slate-300">{d.title}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
