// Some providers (e.g. melolo) serve HEIC posters that browsers cannot render.
// wsrv.nl transcodes them to webp on the fly. Signed URLs are bound to .heic,
// so we cannot just swap the extension — proxy the whole URL instead.
export function posterSrc(url: string | null | undefined, width = 540): string {
  if (!url) return "";
  if (!/\.heic(\?|$)/i.test(url)) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=webp&w=${width}`;
}
