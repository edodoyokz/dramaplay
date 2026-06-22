import assert from "node:assert/strict";
import { playableUrl } from "../src/lib/playable";

assert.equal(
  playableUrl({ streamType: "mp4", streamUrl: "http://cdn.test/video.mp4" }),
  "/stream?u=http%3A%2F%2Fcdn.test%2Fvideo.mp4"
);

assert.equal(
  playableUrl({ streamType: "m3u8", streamUrl: "https://cdn.test/main.m3u8" }),
  "/stream?u=https%3A%2F%2Fcdn.test%2Fmain.m3u8"
);

assert.equal(playableUrl({ streamType: "m3u8", streamUrl: "/proxy/x" }), "/api/proxy/x");

console.log("playableUrl tests passed");
