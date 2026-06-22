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

      const upstream = await fetch(target, {
        headers: { "User-Agent": "Mozilla/5.0", Referer: "https://shorttv.live/" },
      });
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
        return new Response(upstream.body, { status: upstream.status, headers });
      }

      const base = new URL(target);
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
