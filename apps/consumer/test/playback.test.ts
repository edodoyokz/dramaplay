import assert from "node:assert/strict";
import { retryPlay } from "../src/lib/playback";

let attempts = 0;
const ok = await retryPlay(
  async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("not ready");
  },
  4,
  0,
);

assert.equal(ok, true);
assert.equal(attempts, 3);

attempts = 0;
const blocked = await retryPlay(
  async () => {
    attempts += 1;
    throw new Error("blocked");
  },
  2,
  0,
);

assert.equal(blocked, false);
assert.equal(attempts, 2);

console.log("retryPlay tests passed");
