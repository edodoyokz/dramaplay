import assert from "node:assert/strict";
import worker from "../public/_worker.js";

globalThis.fetch = async () =>
  new Response("mp4", { status: 200, headers: { "content-type": "video/mp4" } });

const res = await worker.fetch(new Request("https://dramaplay.my.id/stream?u=http%3A%2F%2Fcdn.test%2Fv.mp4"), {
  ASSETS: { fetch: () => new Response("asset") },
});

assert.equal(res.headers.get("content-type"), "video/mp4");
console.log("worker stream content-type test passed");
