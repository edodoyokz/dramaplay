// Provider CDN apex domains allowed through the /stream proxy. Subdomains
// rotate (acfs1/v3-akm.goodreels.com, video-v6.mydramawave.com), so match by
// suffix. Add a domain here when onboarding a new provider.
// ponytail: suffix allowlist closes the open proxy without breaking subdomain
// rotation; switch to signed stream URLs only if a domain is abused.
const ALLOWED_STREAM_DOMAINS = [
  "goodreels.com",
  "shorttv.live",
  "stardusttv.cc",
  "kjcdn.com",
  "fizzopic.org",
  "mydramawave.com",
  "b-cdn.net",
  "crazymaplestudios.com",
  "reelshort.com",
  "dramaboxdb.com",
  "montagehub.xyz",
  "netshort.com",
  "tiktokcdn.com",
  "inicdn.net",
];

function isAllowedStreamTarget(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  return ALLOWED_STREAM_DOMAINS.some((d) => host === d || host.endsWith("." + d));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      url.hostname = "api.dramaplay.my.id";
      url.pathname = url.pathname.slice(4) || "/";
      return fetch(new Request(url, request));
    }

    // HLS/stream proxy: upstream lacks CORS headers, so proxy same-origin and
    // rewrite manifest URLs back through this endpoint.
    if (url.pathname === "/stream") {
      const target = url.searchParams.get("u");
      if (!target) return new Response("missing u", { status: 400 });
      if (!isAllowedStreamTarget(target)) return new Response("forbidden target", { status: 403 });

      // Forward Range so MP4 seeking works: without it the CDN returns the
      // whole file (200) and the <video> element restarts from 0 on every seek.
      const range = request.headers.get("Range");
      const upstream = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://shorttv.live/",
          ...(range ? { Range: range } : {}),
        },
      });
      // Re-validate after redirects: an allowlisted host can 302 to an
      // arbitrary host, so the final URL must also be on the allowlist.
      // (SSRF / allowlist-bypass guard.)
      const finalUrl = upstream.url || target;
      if (!isAllowedStreamTarget(finalUrl)) return new Response("forbidden redirect", { status: 403 });
      const ct = upstream.headers.get("content-type") ?? "";
      const isManifest = target.includes(".m3u8") || ct.includes("mpegurl");

      const headers = new Headers();
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Cache-Control", "no-cache");

      if (!isManifest) {
        // Force only MPEG-TS segments: some CDNs (dramaboxdb) serve .ts as
        // text/plain + nosniff. Do not relabel MP4 as TS.
        const isTs = target.includes(".ts") || ct.includes("mp2t");
        headers.set("content-type", isTs ? "video/mp2t" : ct || "application/octet-stream");
        // Pass through byte-range support so seeking works on progressive MP4.
        headers.set("Accept-Ranges", "bytes");
        for (const h of ["content-range", "content-length"]) {
          const v = upstream.headers.get(h);
          if (v) headers.set(h, v);
        }
        return new Response(upstream.body, { status: upstream.status, headers });
      }

      const base = new URL(finalUrl);
      const text = await upstream.text();
      const proxy = (ref) => `/stream?u=${encodeURIComponent(new URL(ref, base).toString())}`;
      const rewritten = text
        .split("\n")
        .map((line) => {
          const t = line.trim();
          if (!t) return line;
          if (t.startsWith("#")) {
            // rewrite URI="..." attributes (EXT-X-KEY, EXT-X-MEDIA, etc.)
            return line.replace(/URI="([^"]+)"/g, (_, ref) => `URI="${proxy(ref)}"`);
          }
          return proxy(t);
        })
        .join("\n");

      headers.set("content-type", "application/vnd.apple.mpegurl");
      return new Response(rewritten, { status: upstream.status, headers });
    }

    return env.ASSETS.fetch(request);
  },
};
