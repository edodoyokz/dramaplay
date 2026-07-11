import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { retryPlay } from "../lib/playback";

interface Props {
  source: { streamUrl: string; streamType: "mp4" | "m3u8" | "other" };
  poster?: string;
  subtitleUrl?: string;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VerticalShortPlayer({
  source,
  poster,
  subtitleUrl,
  onEnded,
  onTimeUpdate,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seekBarRef = useRef<HTMLDivElement | null>(null);
  const iconTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantsPlay = useRef(true);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIcon, setShowIcon] = useState<"play" | "pause" | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [playBlocked, setPlayBlocked] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  // ── HLS setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let hls: Hls | null = null;
    let recoveries = 0;
    const isHls = source.streamType === "m3u8";

    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setIsLoading(true);
    setPlayBlocked(false);
    setHasError(false);

    const tryPlay = async () => {
      if (!wantsPlay.current) return;
      const ok = await retryPlay(() => video.play(), 4, 300);
      if (!cancelled) setPlayBlocked(!ok);
    };

    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
      hls.loadSource(source.streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        // Cap recovery so a permanently broken stream surfaces the retry UI
        // instead of looping forever (battery drain + stuck spinner).
        if (recoveries >= 3) {
          setHasError(true);
          hls?.destroy();
          return;
        }
        recoveries += 1;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls?.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError();
        else {
          setHasError(true);
          hls?.destroy();
        }
      });
    } else {
      video.src = source.streamUrl;
      video.load();
      video.addEventListener("canplay", tryPlay, { once: true });
    }

    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => {
      wantsPlay.current = true;
      setIsLoading(false);
      setPlayBlocked(false);
    };
    const onPause = () => {
      if (!video.ended) wantsPlay.current = false;
    };
    const onError = () => setHasError(true);

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);

    return () => {
      cancelled = true;
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
      hls?.destroy();
    };
  }, [source.streamUrl, source.streamType, retryTick]);

  // ── Video event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onDurationChange = () => setDuration(video.duration || 0);
    const onTimeUpdateHandler = () => {
      if (!isSeeking) setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime, video.duration || 0);
      // Buffered
      if (video.buffered.length > 0 && video.duration) {
        setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
      }
    };
    const onFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement);

    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("timeupdate", onTimeUpdateHandler);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("timeupdate", onTimeUpdateHandler);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [isSeeking, onTimeUpdate]);

  // ── Tap to play/pause with animated feedback ──────────────────────────────
  const handleTap = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      wantsPlay.current = true;
      setPlayBlocked(false);
      void retryPlay(() => video.play(), 4, 250).then((ok) => setPlayBlocked(!ok));
      setShowIcon("play");
    } else {
      wantsPlay.current = false;
      video.pause();
      setShowIcon("pause");
    }

    if (iconTimer.current) clearTimeout(iconTimer.current);
    iconTimer.current = setTimeout(() => setShowIcon(null), 700);
  }, []);

  const retrySource = useCallback(() => {
    wantsPlay.current = true;
    setHasError(false);
    setPlayBlocked(false);
    setIsLoading(true);
    setRetryTick((v) => v + 1);
  }, []);

  // ── Seekbar interaction ───────────────────────────────────────────────────
  const calcSeekPercent = useCallback((e: React.PointerEvent | PointerEvent) => {
    const bar = seekBarRef.current;
    if (!bar) return null;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const onSeekStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      setIsSeeking(true);
      const pct = calcSeekPercent(e as unknown as PointerEvent);
      if (pct !== null) setCurrentTime(pct * duration);
      seekBarRef.current?.setPointerCapture(e.pointerId);
    },
    [calcSeekPercent, duration]
  );

  const onSeekMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isSeeking) return;
      e.stopPropagation();
      const pct = calcSeekPercent(e as unknown as PointerEvent);
      if (pct !== null) setCurrentTime(pct * duration);
    },
    [isSeeking, calcSeekPercent, duration]
  );

  const onSeekEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isSeeking) return;
      e.stopPropagation();
      const pct = calcSeekPercent(e as unknown as PointerEvent);
      if (pct !== null && videoRef.current) {
        videoRef.current.currentTime = pct * duration;
      }
      setIsSeeking(false);
    },
    [isSeeking, calcSeekPercent, duration]
  );

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const needsUserAction = playBlocked || hasError;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black flex items-center justify-center select-none overflow-hidden"
      onClick={handleTap}
    >
      {/* ── Video Element ──────────────────────────────────────────── */}
      <video
        ref={videoRef}
        poster={poster}
        autoPlay
        playsInline
        preload="auto"
        // controls only when in native fullscreen (browser adds them)
        onEnded={() => {
          wantsPlay.current = true;
          onEnded?.();
        }}
        className="h-full w-full object-contain"
      >
        {subtitleUrl ? (
          <track src={subtitleUrl} kind="subtitles" srcLang="id" label="Indonesia" default />
        ) : null}
      </video>

      {isLoading && !playBlocked && !hasError ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="h-10 w-10 rounded-full border-4 border-white/20 border-t-white animate-spin" />
        </div>
      ) : null}

      {needsUserAction ? (
        <button
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/45 text-white"
          onClick={(e) => {
            e.stopPropagation();
            wantsPlay.current = true;
            setPlayBlocked(false);
            if (hasError) retrySource();
            else void retryPlay(() => videoRef.current?.play() ?? Promise.reject(), 4, 250).then((ok) => setPlayBlocked(!ok));
          }}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur-md">
            <svg className="w-8 h-8 fill-current ml-1" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="text-xs font-bold tracking-wide">
            {hasError ? "Coba putar ulang" : "Ketuk untuk lanjut"}
          </span>
        </button>
      ) : null}

      {/* ── Tap Feedback Icon ──────────────────────────────────────── */}
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
          showIcon && !needsUserAction ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="w-16 h-16 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center shadow-xl">
          {showIcon === "pause" ? (
            // Pause icon
            <svg className="w-7 h-7 text-white fill-current" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            // Play icon
            <svg className="w-7 h-7 text-white fill-current ml-1" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </div>
      </div>

      {/* ── Bottom Controls Bar ────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 flex flex-col gap-1.5 px-3 pb-2 pt-6"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
        }}
        onClick={(e) => e.stopPropagation()} // prevent tap-toggle on controls
      >
        {/* Time + Fullscreen row */}
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] font-semibold text-zinc-300 tabular-nums tracking-wide">
            {formatTime(currentTime)}
            <span className="text-zinc-600 mx-1">/</span>
            {formatTime(duration)}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Keluar layar penuh" : "Layar penuh"}
            className="w-11 h-11 flex items-center justify-center rounded-md text-zinc-300 hover:text-white active:scale-90 transition-transform"
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0v4m0-4h4M15 9l5-5m0 0v4m0-4h-4M9 15l-5 5m0 0v-4m0 4h4M15 15l5 5m0 0v-4m0 4h-4" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>

        {/* Seekable progress bar */}
        <div
          ref={seekBarRef}
          role="slider"
          tabIndex={0}
          aria-label="Posisi video"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration) || 0}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={`${formatTime(currentTime)} dari ${formatTime(duration)}`}
          className="relative w-full h-4 flex items-center cursor-pointer group"
          onPointerDown={onSeekStart}
          onPointerMove={onSeekMove}
          onPointerUp={onSeekEnd}
          onPointerCancel={onSeekEnd}
        >
          {/* Track background */}
          <div className="absolute inset-y-0 my-auto h-1 w-full rounded-full bg-zinc-700/70 overflow-hidden">
            {/* Buffered */}
            <div
              className="absolute left-0 top-0 h-full bg-zinc-500/50 rounded-full transition-all duration-300"
              style={{ width: `${buffered}%` }}
            />
            {/* Progress */}
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md shadow-black/50 transition-transform duration-100 group-active:scale-125"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>
      </div>
    </div>
  );
}
