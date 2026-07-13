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
  "idrama.video",
  "wetvinfo.com",
  "hakunaymatata.com",
];

// Signed-CDN image hosts whose poster URLs expire (pinedrama: TikTok CDN
// signatures, melolo: signed HEIC). /img caches the fetched bytes by stable
// path so a cover fetched once (while its signature is fresh) is served
// forever after, even once the signed URL expires.
const ALLOWED_IMG_DOMAINS = ["tiktokcdn.com", "fizzopic.org", "wetvinfo.com", "aoneroom.com"];

function isAllowedImgTarget(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false; // images: https only (SSRF guard)
  const host = u.hostname.toLowerCase();
  return ALLOWED_IMG_DOMAINS.some((d) => host === d || host.endsWith("." + d));
}

export function imgCacheKeyForUrl(raw) {
  const t = new URL(raw);
  return encodeURIComponent(t.hostname + t.pathname);
}

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

// WeTV serves WebVTT as a one-segment HLS playlist (.vtt.m3u8). <track> cannot
// load m3u8, so flatten the playlist into a single text/vtt body.
function isVttPlaylist(target, text) {
  if (/\.vtt\.m3u8(\?|$|#)/i.test(target)) return true;
  const media = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  return media.length > 0 && media.every((l) => /\.vtt(\?|$|#)/i.test(l));
}

function hasSubtitleCue(text) {
  return /(?:^|\n)\d{2}:\d{2}:\d{2}[.,]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[.,]\d{3}/m.test(text);
}

async function flattenVttPlaylist(text, baseUrl, fetcher = fetch) {
  const segs = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const abs = new URL(t, baseUrl).toString();
    if (!isAllowedStreamTarget(abs)) throw new Error("forbidden subtitle segment");
    const r = await fetcher(abs, { headers: { "User-Agent": "Mozilla/5.0" } });
    const finalUrl = r.url || abs;
    if (!r.ok) throw new Error("subtitle segment failed");
    if (!isAllowedStreamTarget(finalUrl)) throw new Error("forbidden subtitle redirect");
    const body = (await r.text()).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
    if (!hasSubtitleCue(body)) throw new Error("invalid subtitle segment");
    segs.push(body);
  }
  if (!segs.length) throw new Error("empty subtitle playlist");
  let out = "";
  for (let i = 0; i < segs.length; i++) {
    let body = segs[i];
    if (i === 0) {
      if (!body.startsWith("WEBVTT")) body = `WEBVTT\n\n${body}`;
      out = body;
    } else {
      out += `\n\n${body.replace(/^WEBVTT[^\n]*\n+/, "")}`;
    }
  }
  return out;
}

// ponytail: server-side meta injection for crawlers that don't render JS
// (WhatsApp, Telegram, Facebook, Twitter, GPTBot, Bingbot preview).
// Fetch drama meta from API, inject into HTML <head> before serving.
// Upgrade to full SSR only if client hydration mismatch becomes a problem.
const ORIGIN = "https://dramaplay.my.id";
const API = "https://api.dramaplay.my.id";

// Known SPA routes that should return the shell (not 404).
const KNOWN_PREFIXES = ["/drama/", "/title/", "/provider/", "/search", "/auth", "/profile", "/terms", "/privacy", "/refund", "/promo"];

function isKnownRoute(pathname) {
  if (pathname === "/") return true;
  return KNOWN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

// Resolve poster URL for og:image — mirrors src/lib/img.ts posterSrc but
// server-side (no window.location.origin).
function ogPoster(url) {
  if (!url) return `${ORIGIN}/og-cover.png`;
  if (/\.heic(\?|$)|tiktokcdn\.com|fizzopic\.org|wetvinfo\.com|aoneroom\.com/i.test(url)) {
    return `${ORIGIN}/img?u=${encodeURIComponent(url)}`;
  }
  return url;
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Inject SEO meta tags into the HTML shell for a drama page.
function injectDramaMeta(html, drama, episodeCount) {
  const title = `${escHtml(drama.title)} — Dramaplay`;
  const desc = escHtml(drama.synopsis || `Nonton ${drama.title} — ${episodeCount} episode gratis.`);
  const canonical = `${ORIGIN}/drama/${drama.slug}`;
  const image = ogPoster(drama.posterUrl);
  const year = drama.year || 2026;
  const genres = (drama.genres || []).join(", ");

  // JSON-LD VideoObject
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: drama.title,
    description: drama.synopsis || `Nonton ${drama.title} gratis.`,
    image: image,
    url: canonical,
    datePublished: `${year}-01-01`,
    numberOfEpisodes: episodeCount,
    genre: drama.genres || [],
    inLanguage: "id",
    countryOfOrigin: { "@type": "Country", name: drama.country || "ID" },
    aggregateRating: drama.rating > 0 ? {
      "@type": "AggregateRating",
      ratingValue: drama.rating,
      bestRating: 10,
      ratingCount: 1,
    } : undefined,
  });

  const metaBlock = `
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:type" content="video.tv_show" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${escHtml(image)}" />
    <meta property="og:locale" content="id_ID" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${escHtml(image)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${canonical}" />
    <script type="application/ld+json">${jsonLd}</script>`;

  // Replace existing <title>…</title> through </head> region
  return html
    .replace(/<title>.*?<\/title>/, "")
    .replace(/<meta name="description"[^>]*>/, "")
    .replace(/<meta property="og:title"[^>]*>/, "")
    .replace(/<meta property="og:description"[^>]*>/, "")
    .replace(/<meta property="og:type"[^>]*>/, "")
    .replace(/<meta property="og:url"[^>]*>/, "")
    .replace(/<meta property="og:image"[^>]*>/g, "")
    .replace(/<meta name="twitter:card"[^>]*>/, "")
    .replace(/<meta name="twitter:title"[^>]*>/, "")
    .replace(/<meta name="twitter:description"[^>]*>/, "")
    .replace(/<meta name="twitter:image"[^>]*>/g, "")
    .replace(/<meta name="robots"[^>]*>/, "")
    .replace(/<link rel="canonical"[^>]*>/, "")
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "")
    .replace("</head>", `${metaBlock}\n  </head>`);
}

// 404 page for unknown routes / missing drama slugs.
function notFoundHtml() {
  return `<!doctype html><html lang="id"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>404 — Dramaplay</title></head><body style="background:#030303;color:#aaa;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center"><h1 style="color:#fff">404</h1><p>Halaman tidak ditemukan.</p><a href="/" style="color:#f43f5e">Kembali ke Beranda</a></div></body></html>`;
}

export default {
  async fetch(request, env, ctx) {
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
      // MovieBox (and others) ship SRT; <track> only renders WebVTT.
      const isSrt = /\.srt(\?|$|#)/i.test(target) || /\.srt(\?|$|#)/i.test(finalUrl);
      const isVtt = /\.vtt(\?|$|#)/i.test(target) || /\.vtt(\?|$|#)/i.test(finalUrl);

      const headers = new Headers();
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Cache-Control", "no-cache");

      if (isSrt || isVtt || isManifest) {
        if (!upstream.ok || !upstream.body) {
          return new Response("upstream error", { status: 502 });
        }
      }

      if (isSrt) {
        const text = await upstream.text();
        const body = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
        const cues = body.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
        if (!hasSubtitleCue(cues)) return new Response("invalid subtitle", { status: 502 });
        const vtt = cues.startsWith("WEBVTT") ? cues : `WEBVTT\n\n${cues}`;
        headers.set("content-type", "text/vtt; charset=utf-8");
        return new Response(vtt, { status: 200, headers });
      }

      if (isManifest) {
        const base = new URL(finalUrl);
        const text = await upstream.text();
        if (isVttPlaylist(target, text) || isVttPlaylist(finalUrl, text)) {
          try {
            const vtt = await flattenVttPlaylist(text, base.toString());
            headers.set("content-type", "text/vtt; charset=utf-8");
            return new Response(vtt, { status: 200, headers });
          } catch {
            return new Response("invalid subtitle playlist", { status: 502 });
          }
        }
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

      // Force only MPEG-TS segments: some CDNs (dramaboxdb) serve .ts as
      // text/plain + nosniff. Do not relabel MP4 as TS.
      const isTs = target.includes(".ts") || ct.includes("mp2t");
      if (isVtt) {
        const text = await upstream.text();
        const body = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
        if (!hasSubtitleCue(body)) return new Response("invalid subtitle", { status: 502 });
        headers.set("content-type", "text/vtt; charset=utf-8");
        return new Response(body.startsWith("WEBVTT") ? body : `WEBVTT\n\n${body}`, {
          status: 200,
          headers,
        });
      }
      headers.set(
        "content-type",
        isTs ? "video/mp2t" : ct || "application/octet-stream",
      );
      // Pass through byte-range support so seeking works on progressive MP4.
      headers.set("Accept-Ranges", "bytes");
      for (const h of ["content-range", "content-length"]) {
        const v = upstream.headers.get(h);
        if (v) headers.set(h, v);
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    // Image proxy for signed/expiring CDN covers: cache bytes by stable path
    // so rotating signatures don't evict the entry. Same image => same cache
    // key across signature refreshes/expiries; once cached, served from R2.
    if (url.pathname === "/img") {
      const target = url.searchParams.get("u");
      if (!target) return new Response("missing u", { status: 400 });
      if (!isAllowedImgTarget(target)) return new Response("forbidden target", { status: 403 });

      const t = new URL(target);
      const key = imgCacheKeyForUrl(target);
      const cacheKey = new Request(`https://img-cache/${key}`, { method: "GET" });
      const cache = caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      const r2 = env.IMAGE_CACHE;
      if (r2) {
        const object = await r2.get(key);
        if (object) {
          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set("Cache-Control", "public, max-age=31536000, immutable");
          headers.set("Access-Control-Allow-Origin", "*");
          const resp = new Response(object.body, { status: 200, headers });
          if (ctx) ctx.waitUntil(cache.put(cacheKey, resp.clone()));
          return resp;
        }
      }

      // HEIC isn't browser-renderable; convert via wsrv. Other formats fetch direct.
      const isHeic = /\.heic(\?|$|#)/i.test(t.pathname);
      const upstream = isHeic
        ? await fetch(`https://wsrv.nl/?url=${encodeURIComponent(target)}&output=webp&w=540`, { headers: { "User-Agent": "Mozilla/5.0" } })
        : await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!upstream.ok) return new Response("upstream error", { status: 502 });

      const contentType = isHeic ? "image/webp" : upstream.headers.get("content-type") || "image/jpeg";
      const cacheControl = "public, max-age=31536000, immutable";
      const headers = new Headers();
      headers.set("content-type", contentType);
      headers.set("Cache-Control", cacheControl);
      headers.set("Access-Control-Allow-Origin", "*");
      const resp = new Response(upstream.body, { status: 200, headers });

      const writes = [cache.put(cacheKey, resp.clone())];
      if (r2) {
        writes.push(r2.put(key, resp.clone().body, { httpMetadata: { contentType, cacheControl } }));
      }
      // ponytail: the response does not depend on a best-effort cache write.
      if (ctx) ctx.waitUntil(Promise.all(writes).catch(() => undefined));
      else await Promise.all(writes).catch(() => undefined);
      return resp;
    }

    // --- SEO: server-side meta injection for /drama/:slug ---
    const dramaMatch = url.pathname.match(/^\/drama\/([^/]+)$/);
    if (dramaMatch) {
      const slug = dramaMatch[1];
      try {
        const apiRes = await fetch(`${API}/catalog/dramas/${encodeURIComponent(slug)}`);
        if (!apiRes.ok) {
          // Drama not found → real 404 (not soft 404)
          return new Response(notFoundHtml(), {
            status: 404,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
        const { drama, episodes } = await apiRes.json();
        // Fetch the SPA shell HTML from Pages assets
        const asset = await env.ASSETS.fetch(request.url);
        const html = await asset.text();
        const injected = injectDramaMeta(html, drama, episodes?.length ?? drama.episodeCount ?? 0);
        return new Response(injected, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=300, max-age=60" },
        });
      } catch {
        // API down → fall through to SPA shell (client-side SeoHead still works)
      }
    }

    // --- SEO: proxy sitemap from API (200 instead of 301 redirect) ---
    if (url.pathname === "/sitemap.xml") {
      try {
        const sitemapRes = await fetch(`${API}/sitemap.xml`);
        return new Response(sitemapRes.body, {
          status: sitemapRes.status,
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, max-age=300" },
        });
      } catch {
        // fall through
      }
    }

    // --- SEO: 404 for unknown routes ---
    // ponytail: only catch truly unknown paths; known SPA routes get the shell.
    // Static assets (.js, .css, .png, etc.) are handled by env.ASSETS before
    // this runs, so they won't hit the 404 branch.
    if (!isKnownRoute(url.pathname) && !url.pathname.includes(".")) {
      return new Response(notFoundHtml(), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
