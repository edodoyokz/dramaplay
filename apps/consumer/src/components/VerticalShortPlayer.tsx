import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface Props {
  source: { streamUrl: string; streamType: "mp4" | "m3u8" | "other" };
  poster?: string;
  subtitleUrl?: string;
  onEnded?: () => void;
  onTimeUpdate?: (sec: number) => void;
}

export default function VerticalShortPlayer({ source, poster, subtitleUrl, onEnded, onTimeUpdate }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    let hls: Hls | null = null;
    const isHls = source.streamType === "m3u8";
    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl");
    const keepPlaying = !video.paused || document.fullscreenElement === video;
    const play = () => {
      if (keepPlaying) void video.play().catch(() => {});
    };

    if (isHls && Hls.isSupported() && !nativeHls) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(source.streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, play);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        console.error("hls.js fatal", data.type, data.details, source.streamUrl);
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls?.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError();
        else hls?.destroy();
      });
    } else {
      video.src = source.streamUrl;
      video.addEventListener("canplay", play, { once: true });
    }

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("canplay", play);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      hls?.destroy();
    };
  }, [source.streamUrl, source.streamType]);

  const togglePlay = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center cursor-pointer" onClick={togglePlay}>
      <video
        ref={ref}
        poster={poster}
        autoPlay
        playsInline
        onEnded={() => onEnded?.()}
        onTimeUpdate={(e) => {
          const video = e.currentTarget;
          if (video.duration) {
            setProgress((video.currentTime / video.duration) * 100);
          }
          onTimeUpdate?.(video.currentTime);
        }}
        className="h-full w-full object-contain"
      >
        {subtitleUrl ? <track src={subtitleUrl} kind="subtitles" srcLang="id" label="Indonesia" default /> : null}
      </video>

      {/* Custom Big Play/Pause Icon Overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm border border-zinc-800 flex items-center justify-center text-white scale-110 transition-all duration-300">
            <svg className="w-6 h-6 fill-current ml-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Slim Custom Bottom Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800/80 pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-rose-500 to-orange-500 transition-all duration-100 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
