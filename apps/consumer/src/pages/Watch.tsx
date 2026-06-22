import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import VerticalShortPlayer from "../components/VerticalShortPlayer";
import PricingModal from "../components/PricingModal";

interface StreamResponse {
  streamUrl: string;
  streamType: "mp4" | "m3u8" | "other";
  subtitleUrl?: string;
  posterUrl?: string;
  dramaTitle: string;
  dramaSlug: string;
  episodeNumber: number;
  accessType: "free" | "vip";
  nextEpisode: number | null;
}

export default function Watch() {
  const { slug, n } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<StreamResponse | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [liked, setLiked] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const updateWatchProgress = (stream: StreamResponse, percent: number) => {
    try {
      const stored = localStorage.getItem("dramaplay:watch_progress") || "[]";
      let progressList = JSON.parse(stored);
      if (!Array.isArray(progressList)) progressList = [];

      // Remove existing for same drama
      progressList = progressList.filter((p: { slug: string }) => p.slug !== stream.dramaSlug);

      // Add to front
      progressList.unshift({
        slug: stream.dramaSlug,
        title: stream.dramaTitle,
        posterUrl: stream.posterUrl || null,
        episodeNumber: stream.episodeNumber,
        percent: percent || 5, // minimum 5% to show bar
      });

      // Limit to 10 items
      localStorage.setItem("dramaplay:watch_progress", JSON.stringify(progressList.slice(0, 10)));
    } catch (e) {
      console.error("Watch progress save error", e);
    }
  };

  useEffect(() => {
    let active = true;

    (async () => {
      await Promise.resolve();
      if (!active) return;
      setData(null);
      setBlocked(false);
      setLiked(false);
      setFavorited(false);

      if (!slug || !n) return;

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      try {
        const res = await api<StreamResponse>(`/watch/${slug}/${n}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!active) return;
        if (!res.streamUrl) {
          setFailed(true);
          setData(res);
          return;
        }
        setData(res);
        setFailed(false);
        
        // Track liked and favorited from local storage
        const likes = JSON.parse(localStorage.getItem("dramaplay:likes") || "[]");
        setLiked(likes.includes(`${slug}-${n}`));

        const favs = JSON.parse(localStorage.getItem("dramaplay:favorites") || "[]");
        setFavorited(favs.includes(slug));

        // Initial entry in watch history
        updateWatchProgress(res, 0);
      } catch (e) {
        if (!active) return;
        if (e instanceof Error && e.message.startsWith("403")) {
          setBlocked(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [slug, n]);

  const handleLike = () => {
    if (!data) return;
    const key = `${slug}-${n}`;
    const likes = JSON.parse(localStorage.getItem("dramaplay:likes") || "[]");
    const nextLiked = !liked;
    if (nextLiked) {
      likes.push(key);
      localStorage.setItem("dramaplay:likes", JSON.stringify(likes));
    } else {
      localStorage.setItem("dramaplay:likes", JSON.stringify(likes.filter((k: string) => k !== key)));
    }
    setLiked(nextLiked);
    triggerToast(nextLiked ? "Disukai!" : "Batal menyukai");
  };

  const handleFavorite = () => {
    if (!data) return;
    const favs = JSON.parse(localStorage.getItem("dramaplay:favorites") || "[]");
    const nextFav = !favorited;
    if (nextFav) {
      favs.push(data.dramaSlug);
      localStorage.setItem("dramaplay:favorites", JSON.stringify(favs));
    } else {
      localStorage.setItem("dramaplay:favorites", JSON.stringify(favs.filter((k: string) => k !== data.dramaSlug)));
    }
    setFavorited(nextFav);
    triggerToast(nextFav ? "Ditambahkan ke Favorit" : "Dihapus dari Favorit");
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    triggerToast("Link episode berhasil disalin!");
  };

  const handleReport = () => {
    const reason = window.confirm("Laporkan masalah pemutaran pada video ini?");
    if (reason && data) {
      api("/events", {
        method: "POST",
        body: JSON.stringify({
          eventType: "report_broken",
          dramaSlug: data.dramaSlug,
          episodeNumber: data.episodeNumber,
        }),
      })
        .then(() => triggerToast("Laporan terkirim. Terima kasih!"))
        .catch(() => triggerToast("Terjadi kesalahan mengirim laporan"));
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2500);
  };

  if (blocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#030303] px-6 py-12 text-zinc-100">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 glow-gold mb-2">
          <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
        </div>
        <h1 className="text-xl font-extrabold tracking-wide text-gradient-gold">Episode VIP Terkunci</h1>
        <p className="text-center text-xs text-zinc-400 max-w-xs leading-relaxed">
          Berlangganan VIP Premium sekarang untuk membuka semua episode drama favorit Anda tanpa hambatan.
        </p>
        <div className="flex flex-col gap-2.5 w-full max-w-xs mt-4">
          <button
            onClick={() => setShowPricing(true)}
            className="w-full py-3 rounded-full bg-gradient-sunset text-white font-bold text-sm tracking-wide shadow-lg shadow-rose-500/20 active:scale-95 duration-100"
          >
            Aktifkan VIP Premium
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold text-sm active:scale-95 duration-100"
          >
            Kembali
          </button>
        </div>
        {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
      </div>
    );
  }

  if (failed && data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#030303] px-6 py-12 text-zinc-100">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-2">
          <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        </div>
        <h1 className="text-xl font-extrabold tracking-wide">Stream Tidak Tersedia</h1>
        <p className="text-center text-xs text-zinc-400 max-w-xs leading-relaxed">
          {data.dramaTitle} &middot; Episode {data.episodeNumber}
        </p>
        <div className="flex flex-col gap-2.5 w-full max-w-xs mt-4">
          <button
            onClick={() => { setFailed(false); setData(null); }}
            className="w-full py-3 rounded-full bg-gradient-sunset text-white font-bold text-sm tracking-wide shadow-lg shadow-rose-500/20 active:scale-95 duration-100"
          >
            Coba Lagi
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold text-sm active:scale-95 duration-100"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-zinc-500">
        <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold tracking-wide">Menghubungkan Stream...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black overflow-hidden flex flex-col justify-center">
      {/* Absolute Header Overlay */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
        <button
          onClick={() => navigate(`/drama/${data.dramaSlug}`)}
          className="w-10 h-10 rounded-full bg-black/45 backdrop-blur-md border border-zinc-800 flex items-center justify-center text-white hover:bg-black/75 transition-colors pointer-events-auto shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {data.accessType === "vip" && (
          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-gradient-gold text-zinc-950 uppercase tracking-widest pointer-events-auto glow-gold shadow-md">
            VIP
          </span>
        )}
      </div>

      {/* Main Video Player */}
      <div className="relative w-full aspect-[9/16] bg-black">
        <VerticalShortPlayer
          source={{ streamUrl: data.streamUrl, streamType: data.streamType }}
          poster={data.posterUrl}
          subtitleUrl={data.subtitleUrl}
          onEnded={() => {
            updateWatchProgress(data, 100);
            const next = data.nextEpisode ?? (Number(n ?? 1) + 1);
            navigate(`/drama/${slug}/episode/${next}`);
          }}
          onTimeUpdate={(sec) => {
            // Periodic watch history updates
            updateWatchProgress(data, Math.min(Math.floor(sec * 3), 98));
          }}
        />

        {/* Floating Side Control Overlay */}
        <div className="absolute right-3 bottom-20 z-20 flex flex-col items-center gap-4.5">
          {/* Drama Poster Circle */}
          <Link 
            to={`/drama/${data.dramaSlug}`}
            className="w-11 h-11 rounded-full border-2 border-zinc-300 overflow-hidden shadow-lg animate-spin-slow bg-zinc-900 group"
          >
            <img 
              src={data.posterUrl || ""} 
              alt={data.dramaTitle} 
              className="w-full h-full object-cover" 
            />
          </Link>

          {/* Like Action */}
          <button 
            onClick={handleLike}
            className="flex flex-col items-center gap-1 group active:scale-90 transition-transform pointer-events-auto"
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center border backdrop-blur-md shadow-md transition-all ${
              liked 
                ? "bg-rose-500 border-rose-500 text-white glow-sunset" 
                : "bg-black/40 border-zinc-800 text-zinc-300 hover:text-white"
            }`}>
              <svg className={`w-5.5 h-5.5 ${liked ? "fill-current" : "fill-none"}`} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-bold text-zinc-400 group-hover:text-zinc-200">
              {liked ? "Disukai" : "Suka"}
            </span>
          </button>

          {/* Favorite Action */}
          <button 
            onClick={handleFavorite}
            className="flex flex-col items-center gap-1 group active:scale-90 transition-transform pointer-events-auto"
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center border backdrop-blur-md shadow-md transition-all ${
              favorited 
                ? "bg-amber-500 border-amber-500 text-white glow-gold" 
                : "bg-black/40 border-zinc-800 text-zinc-300 hover:text-white"
            }`}>
              <svg className={`w-5.5 h-5.5 ${favorited ? "fill-current" : "fill-none"}`} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.9 1.393-.9 1.693 0l5.44 11.3a1 1 0 00.95.69h11.82c.987 0 1.397 1.27.607 1.84l-9.56 6.95a1 1 0 00-.36 1.12l3.6 11.09c.3.9-.74 1.66-1.53 1.1l-9.56-6.95a1 1 0 00-1.17 0l-9.56 6.95c-.79.56-1.83-.2-1.53-1.1l3.6-11.09a1 1 0 00-.36-1.12l-9.56-6.95c-.79-.57-.38-1.84.607-1.84h11.82a1 1 0 00.95-.69l5.44-11.3z" />
              </svg>
            </div>
            <span className="text-[10px] font-bold text-zinc-400 group-hover:text-zinc-200">
              Simpan
            </span>
          </button>

          {/* Share Action */}
          <button 
            onClick={handleShare}
            className="flex flex-col items-center gap-1 group active:scale-90 transition-transform pointer-events-auto"
          >
            <div className="w-11 h-11 rounded-full bg-black/40 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center backdrop-blur-md shadow-md transition-all">
              <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 10.742l4.636-2.5m0 7.508l-4.636-2.5m10.19C20.3 12.33 19 14.16 19 16c0 1.84 1.3 3.67 3.5 3.67s3.5-1.83 3.5-3.67c0-1.84-1.3-3.67-3.5-3.67zm-11 0c2.2 0 3.5-1.83 3.5-3.67S10.2 6 8 6s-3.5 1.83-3.5 3.67 1.3 3.67 3.5 3.67zm-11 0c2.2 0 3.5-1.83 3.5-3.67S10.2 12 8 12s-3.5 1.83-3.5 3.67 1.3 3.67 3.5 3.67z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 10.742a3.375 3.375 0 11-3.375-3.375 3.375 3.375 0 013.375 3.375zm0 2.516a3.375 3.375 0 11-3.375 3.375 3.375 0 013.375-3.375zm11-6.258a3.375 3.375 0 11-3.375 3.375 3.375 0 013.375-3.375z" />
              </svg>
            </div>
            <span className="text-[10px] font-bold text-zinc-400 group-hover:text-zinc-200">
              Bagikan
            </span>
          </button>

          {/* Report Action */}
          <button 
            onClick={handleReport}
            className="flex flex-col items-center gap-1 group active:scale-90 transition-transform pointer-events-auto"
          >
            <div className="w-11 h-11 rounded-full bg-black/40 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center backdrop-blur-md shadow-md transition-all">
              <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <span className="text-[10px] font-bold text-zinc-400 group-hover:text-zinc-200">
              Lapor
            </span>
          </button>
        </div>

        {/* Absolute Bottom Information Overlay */}
        <div className="absolute left-4 bottom-14 right-16 z-20 pointer-events-none flex flex-col gap-1">
          <h2 className="text-sm font-extrabold text-white tracking-tight drop-shadow-md">
            {data.dramaTitle}
          </h2>
          <p className="text-[11px] font-bold text-rose-400 tracking-wide drop-shadow-md">
            Episode {data.episodeNumber}
          </p>
          <p className="text-[10px] text-zinc-400 leading-normal line-clamp-2 drop-shadow-md">
            Ketuk tombol putar untuk menjeda atau menggunakan pengatur kecepatan video.
          </p>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-semibold text-xs shadow-xl animate-fadeIn pointer-events-none whitespace-nowrap">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
