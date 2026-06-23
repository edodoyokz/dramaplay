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

console.log("worker stream allowlist tests passed");
