// Subtitle format helpers. The browser <track> element only renders WebVTT;
// SRT must be converted before serving. Sync may store SRT for audit/cache, but
// watch must not return a raw .srt to <track>.

export function subtitleFormatFromUrl(url: string): "vtt" | "srt" {
  return /\.vtt(\?|$|#)/i.test(url) ? "vtt" : "srt";
}

// SRT cannot be rendered by <track>; treat explicit .srt as non-renderable.
// Anything else (incl. unknown ext) is assumed renderable — providers that
// serve SRT with a non-.srt URL will be caught by the audit warning later.
export function isRenderableSubtitle(url: string): boolean {
  return !/\.srt(\?|$|#)/i.test(url);
}
