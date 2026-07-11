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

// Subtitles load as a same-origin <track>: cross-origin VTT hosts (dramawave)
// lack CORS headers, so proxy them through /stream (which adds ACAO + keeps
// the response same-origin). Relative/proxy URLs pass through unchanged.
export function subtitleProxyUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/")) return url;
  if (/^https?:\/\//.test(url)) return `/stream?u=${encodeURIComponent(url)}`;
  return url;
}
