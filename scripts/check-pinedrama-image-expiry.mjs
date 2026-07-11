import assert from "node:assert/strict";
import { imgCacheKeyForUrl } from "../apps/consumer/public/_worker.js";

const base = "https://p16-common-sign.tiktokcdn.com/obj/tos-maliva-p-0068/image.jpeg";

assert.equal(
  imgCacheKeyForUrl(`${base}?x-expires=1&x-signature=old`),
  imgCacheKeyForUrl(`${base}?x-expires=2&x-signature=new`),
  "signed query changes must not change the durable image key",
);

assert.notEqual(
  imgCacheKeyForUrl("https://p16-common-sign.tiktokcdn.com/obj/image-a.jpeg?x=1"),
  imgCacheKeyForUrl("https://p16-common-sign.tiktokcdn.com/obj/image-b.jpeg?x=1"),
  "different image paths must use different keys",
);

console.log("pinedrama image cache key check passed");
