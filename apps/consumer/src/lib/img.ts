// Some providers serve formats/domains that mobile WebViews dislike:
// - melolo: signed HEIC
// - pinedrama: TikTok signed image CDN
export function posterSrc(url: string | null | undefined, width = 540): string {
  if (!url) return "";
  if (!/\.heic(\?|$)|tiktokcdn\.com/i.test(url)) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=webp&w=${width}`;
}
