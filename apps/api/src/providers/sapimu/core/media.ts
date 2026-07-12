// Subtitle format helpers. The browser <track> element only renders WebVTT.
// SRT is allowed through the API; the consumer /stream proxy converts it to VTT.

export function subtitleFormatFromUrl(url: string): "vtt" | "srt" {
  return /\.vtt(\?|$|#)/i.test(url) ? "vtt" : "srt";
}

// True when the consumer can show the cue list. .srt is ok because /stream
// rewrites timestamps and prefixes WEBVTT before <track> loads it.
export function isRenderableSubtitle(url: string): boolean {
  return Boolean(url);
}

/** Convert SubRip text to WebVTT (browser <track> format). */
export function srtToVtt(srt: string): string {
  const body = srt.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const cues = body
    // SRT uses comma millis; VTT uses dot
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return cues.startsWith("WEBVTT") ? cues : `WEBVTT\n\n${cues}`;
}
