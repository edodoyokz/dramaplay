import { useEffect, useRef } from "react";
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

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    let hls: Hls | null = null;
    const isHls = source.streamType === "m3u8";
    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl");

    if (isHls && Hls.isSupported() && !nativeHls) {
      // hls.js handles HE-AAC and codec edge cases that video.js/VHS chokes on.
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(source.streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        console.error("hls.js fatal", data.type, data.details, source.streamUrl);
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls?.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError();
        else hls?.destroy();
      });
    } else {
      // Native: Safari HLS, or direct mp4.
      video.src = source.streamUrl;
    }

    return () => {
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [source.streamUrl, source.streamType]);

  return (
    <video
      ref={ref}
      poster={poster}
      controls
      autoPlay
      playsInline
      onEnded={() => onEnded?.()}
      onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
      className="h-full w-full bg-black object-contain"
    >
      {subtitleUrl ? <track src={subtitleUrl} kind="subtitles" srcLang="id" label="Indonesia" default /> : null}
    </video>
  );
}
