import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { posterSrc } from "../lib/img";
import { getWatchProgress, type WatchProgressItem } from "../lib/local-engagement";
import { mediaTypeLabel, titlePath } from "../lib/content-route";
import { SeoHead } from "../lib/seo";

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
  contentType?: "shortform" | "longform";
  mediaType?: "movie" | "series";
  provider?: { code: string; name: string; contentType?: string };
}

interface ProviderShelf {
  code: string;
  name: string;
  logoUrl?: string | null;
  contentType?: "shortform" | "longform";
  dramaCount: number;
  episodeCount: number;
  items: Drama[];
}

export default function Home() {
  const [shelves, setShelves] = useState<ProviderShelf[]>([]);
  const [loadingHome, setLoadingHome] = useState(true);
  const [homeError, setHomeError] = useState(false);
  const [progressList, setProgressList] = useState<WatchProgressItem[]>(() => getWatchProgress().slice(0, 5));
  const [userVip, setUserVip] = useState(false);

  function loadHome() {
    setLoadingHome(true);
    setHomeError(false);
    api<{ providers: ProviderShelf[] }>("/catalog/home")
      .then((r) => {
        setShelves(r.providers);
        setHomeError(false);
      })
      .catch(() => {
        setShelves([]);
        setHomeError(true);
      })
      .finally(() => setLoadingHome(false));
  }

  useEffect(() => {
    loadHome();
    setProgressList(getWatchProgress().slice(0, 5));

    const onFocus = () => setProgressList(getWatchProgress().slice(0, 5));
    window.addEventListener("focus", onFocus);

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

    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 pb-12">
      <SeoHead title="Streaming Drama Pendek Indonesia Gratis" description="Nonton dracin, short drama, dan series vertikal terbaik gratis setiap hari. Koleksi lengkap drama China, Korea, dan Indonesia." />
      {/* Immersive Glass Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-md border-b border-zinc-900/60">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo-app.png" alt="Dramaplay Logo" className="w-8 h-8 rounded-lg object-cover shadow-md" />
          <h1 className="text-xl font-extrabold tracking-tight text-gradient-sunset">
            Dramaplay
          </h1>
        </Link>

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
          <Link
            to="/search"
            aria-label="Cari drama"
            className="inline-flex h-11 w-11 items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>
        </div>
      </header>

      {/* Continue Watching Section */}
      {progressList.length > 0 && (
        <section className="mt-6 px-4">
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
                      src={posterSrc(progress.posterUrl)}
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

      {/* Provider Shelves */}
      <div className="mt-8 px-4 space-y-8">
        {loadingHome ? (
          <div className="grid grid-cols-3 gap-3" aria-busy="true" aria-label="Memuat katalog">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="aspect-[2/3] rounded-xl bg-zinc-900 animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-zinc-900 animate-pulse" />
                <div className="h-2 w-1/2 rounded bg-zinc-900 animate-pulse" />
              </div>
            ))}
          </div>
        ) : null}
        {homeError ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
            <p>Gagal memuat katalog.</p>
            <button
              type="button"
              onClick={loadHome}
              className="mt-3 rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-white"
            >
              Coba Lagi
            </button>
          </div>
        ) : null}
        {!loadingHome && !homeError
          ? shelves.map((shelf) => <ProviderSection key={shelf.code} shelf={shelf} />)
          : null}
      </div>
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

function ProviderSection({ shelf }: { shelf: ProviderShelf }) {
  if (shelf.items.length === 0) return null;

  return (
    <section className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ProviderLogo name={shelf.name} logoUrl={shelf.logoUrl} />
          <div>
            <h3 className="text-md font-bold text-white tracking-wide">{shelf.name}</h3>
            <p className="text-[10px] text-zinc-500">
              {shelf.contentType === "longform" ? "Film & Serial" : "Drama pendek"} • {shelf.dramaCount} judul • {shelf.episodeCount} episode
            </p>
          </div>
        </div>
        <Link
          to={`/provider/${shelf.code}`}
          className="inline-flex min-h-11 items-center px-2 text-[10px] font-bold text-rose-500 uppercase tracking-widest"
        >
          Lihat Semua
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {shelf.items.map((d) => (
          <DramaCard key={d.id} drama={d} />
        ))}
      </div>
    </section>
  );
}

function DramaCard({ drama: d }: { drama: Drama }) {
  const label = mediaTypeLabel(d.mediaType);
  return (
    <Link to={titlePath(d.slug, d.contentType)} className="block group">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800/80 shadow-md group-hover:border-rose-500/30 transition-all duration-300">
        {d.posterUrl ? (
          <img
            src={posterSrc(d.posterUrl)}
            alt={d.title}
            className="h-full w-full object-cover transform scale-100 group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
            <span className="text-[10px] text-zinc-500">No Image</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-100 transition-opacity" />

        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 items-end">
          {label ? (
            <span className="px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-black/65 text-sky-300 border border-sky-400/20">
              {label}
            </span>
          ) : null}
          {d.rating && d.rating > 0 ? (
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-black/60 backdrop-blur-md text-amber-400 flex items-center gap-0.5 border border-amber-400/20">
              ★ {d.rating.toFixed(1)}
            </span>
          ) : null}
        </div>

        {d.episodeCount > 0 ? (
          <div className="absolute bottom-1.5 left-1.5">
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 backdrop-blur-md text-rose-400 border border-rose-500/20">
              {d.contentType === "longform" && d.mediaType === "movie" ? "Film" : `${d.episodeCount} Eps`}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-2 px-0.5">
        <h4 className="truncate text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors duration-200">
          {d.title}
        </h4>
        {d.year || d.country ? (
          <p className="text-[9px] text-zinc-500 mt-0.5">
            {[d.year, d.country].filter(Boolean).join(" • ")}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
