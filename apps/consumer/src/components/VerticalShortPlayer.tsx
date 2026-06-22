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

export default function VerticalShortPlayer({ source, poster, subtitleUrl, onEnded, onTimeUpdate }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  // Keep latest callbacks without re-initializing the player.
  const cbRef = useRef({ onEnded, onTimeUpdate });
  cbRef.current = { onEnded, onTimeUpdate };

  // Init player once.
  useEffect(() => {
    if (!ref.current || playerRef.current) return;
    const player = videojs(ref.current, {
      controls: true,
      fill: true,
      preload: "auto",
      html5: { vhs: { overrideNative: true } },
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
    });
    playerRef.current = player;

    player.on("error", () => {
      const e = player.error();
      console.error("Video.js playback error", e?.code, e?.message, player.currentSrc());
    });
    player.on("ended", () => cbRef.current.onEnded?.());
    player.on("timeupdate", () => cbRef.current.onTimeUpdate?.(player.currentTime() ?? 0));

    return () => {
      player.dispose();
      playerRef.current = null;
    };
  }, []);

  // Update source / poster / subtitle when they change.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (poster) player.poster(poster);
    player.src({ src: source.streamUrl, type: source.streamType === "m3u8" ? "application/x-mpegURL" : "video/mp4" });
    player.load();

    const tracks = player.remoteTextTracks() as unknown as { length: number; [i: number]: HTMLTrackElement };
    for (let i = tracks.length - 1; i >= 0; i--) {
      if (tracks[i]) player.removeRemoteTextTrack(tracks[i]);
    }
    if (subtitleUrl) {
      player.addRemoteTextTrack({ src: subtitleUrl, kind: "subtitles", srclang: "id", label: "Indonesia", default: true }, false);
    }
  }, [source.streamUrl, source.streamType, poster, subtitleUrl]);

  return (
    <div data-vjs-player className="h-full w-full bg-black">
      <video ref={ref} className="video-js vjs-big-play-centered h-full w-full" playsInline />
    </div>
  );
}
