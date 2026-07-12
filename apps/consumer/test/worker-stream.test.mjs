import assert from "node:assert/strict";
import worker from "../public/_worker.js";

globalThis.fetch = async () =>
  new Response("mp4", { status: 200, headers: { "content-type": "video/mp4" } });

const env = { ASSETS: { fetch: () => new Response("asset") } };

// Allowed CDN domain proxies through.
const ok = await worker.fetch(
  new Request("https://dramaplay.my.id/stream?u=https%3A%2F%2Facfs1.goodreels.com%2Fv.mp4"),
  env,
);
assert.equal(ok.headers.get("content-type"), "video/mp4");

// Unknown host is rejected (open-proxy closed).
const blocked = await worker.fetch(
  new Request("https://dramaplay.my.id/stream?u=https%3A%2F%2Fnot-allowed.example%2Fv.mp4"),
  env,
);
assert.equal(blocked.status, 403);

// Non-http scheme is rejected.
const badScheme = await worker.fetch(
  new Request("https://dramaplay.my.id/stream?u=file%3A%2F%2F%2Fetc%2Fpasswd"),
  env,
);
assert.equal(badScheme.status, 403);

// Redirect to a non-allowlisted host is rejected after following (SSRF guard).
globalThis.fetch = async () => ({
  url: "https://not-allowed.example/redirected.mp4",
  status: 200,
  body: "mp4",
  headers: new Headers({ "content-type": "video/mp4" }),
  text: async () => "mp4",
});
const redirected = await worker.fetch(
  new Request("https://dramaplay.my.id/stream?u=https%3A%2F%2Facfs1.goodreels.com%2Fv.mp4"),
  env,
);
assert.equal(redirected.status, 403);

// SRT captions are converted to WebVTT for <track>.
globalThis.fetch = async () =>
  new Response("1\n00:00:01,000 --> 00:00:02,500\nHalo\n", {
    status: 200,
    headers: { "content-type": "application/x-subrip" },
    url: "https://cacdn.hakunaymatata.com/subtitle/id.srt",
  });
const srt = await worker.fetch(
  new Request("https://dramaplay.my.id/stream?u=https%3A%2F%2Fcacdn.hakunaymatata.com%2Fsubtitle%2Fid.srt"),
  env,
);
assert.equal(srt.status, 200);
assert.equal(srt.headers.get("content-type"), "text/vtt; charset=utf-8");
const vtt = await srt.text();
assert.ok(vtt.startsWith("WEBVTT"));
assert.ok(vtt.includes("00:00:01.000 --> 00:00:02.500"));
assert.ok(vtt.includes("Halo"));

console.log("worker stream allowlist tests passed");

// ── /img proxy: caches signed/expiring CDN covers by stable path ────────
// Mock the Cache API (caches.default) used by the worker; node test env lacks it.
const cacheStore = new Map();
globalThis.caches = {
  default: {
    match: async (key) => cacheStore.get(String(key)) ?? null,
    put: async (key, resp) => {
      cacheStore.set(String(key), new Response(resp.body, resp));
    },
  },
};
const imgEnv = { ASSETS: { fetch: () => new Response("asset") } };
const imgCtx = { waitUntil: (p) => p };

// Fresh fetch returns an image; /img proxies and caches it.
globalThis.fetch = async () =>
  new Response("\x89PNG bytes", { status: 200, headers: { "content-type": "image/jpeg" } });
const img = await worker.fetch(
  new Request("https://dramaplay.my.id/img?u=https%3A%2F%2Fp16-common-sign.tiktokcdn.com%2Ftos%2Fimg.jpeg%3Fx-expires%3D1"),
  imgEnv,
  imgCtx,
);
assert.equal(img.headers.get("content-type"), "image/jpeg");
assert.equal(img.headers.get("cache-control"), "public, max-age=31536000, immutable");
// A second hit is served from cache (cacheStore now has the entry).
let fetchedAgain = false;
globalThis.fetch = async () => {
  fetchedAgain = true;
  return new Response("other", { status: 200 });
};
const cached = await worker.fetch(
  new Request("https://dramaplay.my.id/img?u=https%3A%2F%2Fp16-common-sign.tiktokcdn.com%2Ftos%2Fimg.jpeg%3Fx-expires%3D2"),
  imgEnv,
  imgCtx,
);
// Same image path (different signature) => same cache key, no re-fetch.
assert.equal(fetchedAgain, false);
assert.equal(cached.headers.get("content-type"), "image/jpeg");

// Non-allowlisted host is rejected (open-proxy / SSRF guard).
const imgBlocked = await worker.fetch(
  new Request("https://dramaplay.my.id/img?u=https%3A%2F%2Fnot-allowed.example%2Fimg.jpg"),
  imgEnv,
  imgCtx,
);
assert.equal(imgBlocked.status, 403);

// Non-https scheme is rejected.
const imgBadScheme = await worker.fetch(
  new Request("https://dramaplay.my.id/img?u=file%3A%2F%2F%2Fetc%2Fpasswd"),
  imgEnv,
  imgCtx,
);
assert.equal(imgBadScheme.status, 403);

console.log("worker /img cache tests passed");
