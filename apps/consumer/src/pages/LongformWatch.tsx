import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { posterSrc } from "../lib/img";
import { subtitleProxyUrl } from "../lib/playable";
import { attachLongformPlayback } from "../lib/longform-playback";
import { upsertWatchProgress } from "../lib/local-engagement";
import { progressPercent } from "../lib/ux";
import { watchPath } from "../lib/content-route";
import PricingModal from "../components/PricingModal";

interface StreamResponse {
  streamUrl: string;
  streamType: "mp4" | "m3u8" | "other";
  subtitleUrl?: string;
  subtitleLanguage?: "id";
  posterUrl?: string;
  dramaTitle: string;
  dramaSlug: string;
  seasonNumber: number;
  episodeNumber: number;
  accessType: "free" | "vip";
  nextEpisode: { seasonNumber: number; episodeNumber: number } | null;
}

export default function LongformWatch() {
  const { slug, season, episode, n } = useParams();
  const seasonNumber = Number(season ?? 1);
  const episodeNumber = Number(episode ?? n);
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastProgressSave = useRef(0);
  const [data, setData] = useState<StreamResponse | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!slug || !Number.isInteger(episodeNumber) || episodeNumber < 1) return;
      setBlocked(false);
      setFailed(false);
      setData(null);
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      try {
        const path = Number.isInteger(seasonNumber)
          ? `/watch/${slug}/${seasonNumber}/${episodeNumber}`
          : `/watch/${slug}/${episodeNumber}`;
        const res = await api<StreamResponse>(path, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!active) return;
        if (!res.streamUrl) {
          setFailed(true);
          setData(res);
          return;
        }
        setData(res);
        upsertWatchProgress({
          slug: res.dramaSlug,
          title: res.dramaTitle,
          posterUrl: res.posterUrl || null,
          seasonNumber: res.seasonNumber,
          episodeNumber: res.episodeNumber,
          percent: 5,
        });
      } catch (e) {
        if (!active) return;
        if (e instanceof Error && e.message.startsWith("403")) setBlocked(true);
        else setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, seasonNumber, episodeNumber, retryTick]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !data?.streamUrl) return;
    return attachLongformPlayback(video, data, () => setFailed(true));
  }, [data]);

  if (blocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-zinc-100">
        <h1 className="text-xl font-extrabold text-gradient-gold">Konten VIP Terkunci</h1>
        <p className="text-center text-xs text-zinc-400 max-w-xs">
          Beli VIP sekali untuk membuka episode terkunci selama masa aktif paket.
        </p>
        <button type="button" onClick={() => setShowPricing(true)} className="w-full max-w-xs py-3 rounded-full bg-gradient-sunset text-white font-bold text-sm">
          Aktifkan VIP
        </button>
        <button type="button" onClick={() => navigate(-1)} className="w-full max-w-xs py-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold text-sm">
          Kembali
        </button>
        {showPricing ? <PricingModal onClose={() => setShowPricing(false)} /> : null}
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-zinc-100">
        <h1 className="text-xl font-extrabold">Stream Tidak Tersedia</h1>
        <button type="button" onClick={() => setRetryTick((v) => v + 1)} className="w-full max-w-xs py-3 rounded-full bg-gradient-sunset text-white font-bold text-sm">
          Coba Lagi
        </button>
        <button type="button" onClick={() => navigate(-1)} className="w-full max-w-xs py-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold text-sm">
          Kembali
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-zinc-500">
        <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold">Menghubungkan Stream...</p>
      </div>
    );
  }

  const episodeLabel =
    data.seasonNumber > 0
      ? `S${data.seasonNumber} E${data.episodeNumber}`
      : `Episode ${data.episodeNumber}`;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex items-center gap-3 px-3 py-3 border-b border-zinc-900">
        <button
          type="button"
          onClick={() => navigate(`/title/${data.dramaSlug}`)}
          aria-label="Kembali"
          className="w-11 h-11 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold">{data.dramaTitle}</h1>
          <p className="text-[11px] text-zinc-400">{episodeLabel}</p>
        </div>
      </div>

      <div className="relative bg-black aspect-video w-full max-w-3xl mx-auto">
        <video
          ref={videoRef}
          className="w-full h-full bg-black"
          controls
          playsInline
          poster={posterSrc(data.posterUrl)}
          onEnded={() => {
            upsertWatchProgress({
              slug: data.dramaSlug,
              title: data.dramaTitle,
              posterUrl: data.posterUrl || null,
              seasonNumber: data.seasonNumber,
              episodeNumber: data.episodeNumber,
              percent: 100,
            });
            if (data.nextEpisode) {
              navigate(
                watchPath(
                  data.dramaSlug,
                  data.nextEpisode.episodeNumber,
                  "longform",
                  data.nextEpisode.seasonNumber,
                ),
              );
            } else navigate(`/title/${data.dramaSlug}`);
          }}
          onTimeUpdate={(e) => {
            const video = e.currentTarget;
            const now = Date.now();
            if (now - lastProgressSave.current < 10_000) return;
            lastProgressSave.current = now;
            const pct = progressPercent(video.currentTime, video.duration || 0);
            upsertWatchProgress({
              slug: data.dramaSlug,
              title: data.dramaTitle,
              posterUrl: data.posterUrl || null,
              seasonNumber: data.seasonNumber,
              episodeNumber: data.episodeNumber,
              percent: pct === 0 ? 5 : Math.min(pct, 98),
            });
          }}
        >
          {data.subtitleLanguage === "id" && data.subtitleUrl ? (
            <track
              kind="subtitles"
              srcLang="id"
              label="Indonesia"
              src={subtitleProxyUrl(data.subtitleUrl)}
              default
            />
          ) : null}
        </video>
      </div>

      <div className="px-4 py-4 flex gap-2">
        <Link to={`/title/${data.dramaSlug}`} className="rounded-full border border-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300">
          Detail
        </Link>
        {data.nextEpisode ? (
          <Link
            to={watchPath(
              data.dramaSlug,
              data.nextEpisode.episodeNumber,
              "longform",
              data.nextEpisode.seasonNumber,
            )}
            className="rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-white"
          >
            Episode Berikutnya
          </Link>
        ) : null}
      </div>
    </div>
  );
}
