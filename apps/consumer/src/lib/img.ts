// Some providers serve signed/expiring CDN covers (pinedrama: TikTok CDN
// signatures ~1-day TTL, melolo: signed HEIC). Route them through /img, which
// caches the fetched bytes by stable path on the consumer worker so a cover
// fetched once (while its signature is fresh) is served forever after — no
// more expired-cover 403s. Stable-URL providers (dramawave mydramawave.com)
// pass through unchanged.
export function posterSrc(url: string | null | undefined): string {
  if (!url) return "";
  if (!/\.heic(\?|$)|tiktokcdn\.com|fizzopic\.org/i.test(url)) return url;
  // Absolute so it works as both <img src> and og:image (crawlers need absolute).
  return `${window.location.origin}/img?u=${encodeURIComponent(url)}`;
}
