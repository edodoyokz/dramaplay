export type StreamLike = { streamUrl: string; streamType: "mp4" | "m3u8" | "other" };

export function playableUrl(data: StreamLike) {
  if (data.streamUrl.startsWith("/proxy/")) return `/api${data.streamUrl}`;
  if (data.streamUrl.startsWith("/")) return data.streamUrl;
  // ponytail: proxy http media to avoid HTTPS mixed-content blocks; proxy HLS
  // too so manifests/segments are rewritten same-origin.
  if (data.streamType === "m3u8" || data.streamUrl.startsWith("http://")) {
    return `/stream?u=${encodeURIComponent(data.streamUrl)}`;
  }
  return data.streamUrl;
}
