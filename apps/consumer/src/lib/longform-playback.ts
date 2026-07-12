import Hls from "hls.js";
import { playableUrl } from "./playable";

export type LongformSource = {
  streamUrl: string;
  streamType: "mp4" | "m3u8" | "other";
};

export type PlaybackFailure = (message: string) => void;

export function attachLongformPlayback(
  video: HTMLVideoElement,
  source: LongformSource,
  onFailure: PlaybackFailure,
  createHls: () => Hls = () => new Hls(),
): () => void {
  let cleaned = false;
  let recovered = false;
  let failed = false;
  let hls: Hls | null = null;

  const fail = (message: string) => {
    if (failed || cleaned) return;
    failed = true;
    cleanup();
    onFailure(message);
  };

  const onNativeError = () => {
    if (cleaned || failed) return;
    if (!recovered) {
      recovered = true;
      try {
        video.load();
      } catch {
        fail("native_load_failed");
      }
      return;
    }
    fail("native_media_error");
  };

  const src = playableUrl(source);

  if (source.streamType === "m3u8" && Hls.isSupported()) {
    hls = createHls();
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data?.fatal || cleaned || failed) return;
      if (!recovered) {
        recovered = true;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls?.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls?.recoverMediaError();
          return;
        }
      }
      fail(`hls_${String(data.type ?? "fatal")}`);
    });
  } else {
    video.src = src;
    video.addEventListener("error", onNativeError);
  }

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    video.removeEventListener("error", onNativeError);
    if (hls) {
      hls.destroy();
      hls = null;
    }
    video.removeAttribute("src");
    try {
      video.load();
    } catch {
      // ignore cleanup load errors
    }
  }

  return cleanup;
}
