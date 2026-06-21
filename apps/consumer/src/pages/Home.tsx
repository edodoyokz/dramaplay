import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

interface Drama {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  country: string | null;
  year: number | null;
}

export default function Home() {
  const [trending, setTrending] = useState<Drama[]>([]);
  const [fresh, setFresh] = useState<Drama[]>([]);

  useEffect(() => {
    api<{ items: Drama[] }>("/catalog/trending")
      .then((r) => setTrending(r.items))
      .catch(() => setTrending([]));
    api<{ items: Drama[] }>("/catalog/new")
      .then((r) => setFresh(r.items))
      .catch(() => setFresh([]));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-yellow-400">Dramaplay</h1>
        <div className="flex items-center gap-3">
          <Link to="/search" className="text-sm text-slate-300">
            🔍
          </Link>
          <Link to="/profile" className="text-sm text-slate-300">
            Akun
          </Link>
        </div>
      </header>

      <Section title="Trending" items={trending} />
      <Section title="Baru" items={fresh} />
    </div>
  );
}

function Section({ title, items }: { title: string; items: Drama[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>
      <div className="grid grid-cols-3 gap-3">
        {items.map((d) => (
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
    </section>
  );
}
