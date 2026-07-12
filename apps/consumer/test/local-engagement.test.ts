import assert from "node:assert/strict";
import {
  getProgressForSlug,
  upsertWatchProgress,
  type WatchProgressItem,
} from "../src/lib/local-engagement.ts";

const storage = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => {
    storage.set(key, value);
  },
  removeItem: (key) => {
    storage.delete(key);
  },
  clear: () => storage.clear(),
  key: () => null,
  length: 0,
} as Storage;

storage.clear();
upsertWatchProgress({
  slug: "avatar",
  title: "Avatar",
  seasonNumber: 2,
  episodeNumber: 1,
  percent: 40,
});
const saved = getProgressForSlug("avatar");
assert.equal(saved?.seasonNumber, 2);
assert.equal(saved?.episodeNumber, 1);

storage.set(
  "dramaplay:watch_progress",
  JSON.stringify([{ slug: "legacy", episodeNumber: 3 } satisfies WatchProgressItem]),
);
const legacy = getProgressForSlug("legacy");
assert.equal(legacy?.seasonNumber ?? 1, 1);
assert.equal(legacy?.episodeNumber, 3);

console.log("local-engagement tests passed");
