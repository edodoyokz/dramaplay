import { useEffect, useRef } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import type Player from "video.js/dist/types/player";

interface Props {
  source: { streamUrl: string; streamType: "mp4" | "m3u8" | "other" };
  poster?: string;
  subtitleUrl?: string;
  onEnded?: () => void;
  onTimeUpdate?: (sec: number) => void;
}

export default function VerticalShortPlayer({
  source,
  poster,
  subtitleUrl,
  onEnded,
  onTimeUpdate,
}: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const player = videojs(ref.current, {
      controls: true,
      fluid: true,
      poster,
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
    });
    playerRef.current = player;

    if (source.streamType === "m3u8") {
      player.src({ src: source.streamUrl, type: "application/x-mpegURL" });
    } else if (source.streamType === "mp4") {
      player.src({ src: source.streamUrl, type: "video/mp4" });
    }

    if (subtitleUrl) {
      player.addRemoteTextTrack(
        {
          src: subtitleUrl,
          kind: "subtitles",
          srclang: "id",
          label: "Indonesia",
          default: true,
        },
        false
      );
    }

    player.on("ended", () => onEnded?.());
    player.on("timeupdate", () => onTimeUpdate?.(player.currentTime() ?? 0));

    return () => {
      player.dispose();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.streamUrl, source.streamType, subtitleUrl]);

  return (
    <div className="aspect-[9/16] bg-black">
      <div data-vjs-player>
        <video
          ref={ref}
          className="video-js vjs-big-play-centered h-full w-full"
          playsInline
        />
      </div>
    </div>
  );
}
