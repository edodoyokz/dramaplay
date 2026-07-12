import { describe, expect, it } from "vitest";
import {
  classifyDeepFillKind,
  defaultSyncBudgets,
  isTimeBudgetExhausted,
  resolveSyncBudgets,
  selectDeepFillCandidates,
  takeEpisodeInsertBatch,
  type DeepFillCandidate,
} from "../src/sync/budget";

describe("defaultSyncBudgets", () => {
  it("uses tighter caps for longform providers", () => {
    expect(defaultSyncBudgets("wetv")).toEqual({
      maxItems: 250,
      maxNewEpisodeDramas: 10,
      maxEpisodesPerDrama: 200,
      timeBudgetMs: 300_000,
    });
    expect(defaultSyncBudgets("moviebox")).toEqual(defaultSyncBudgets("wetv"));
    expect(defaultSyncBudgets("shortmax").maxItems).toBe(80);
  });
});

describe("resolveSyncBudgets", () => {
  it("prefers overrides then env then defaults", () => {
    const b = resolveSyncBudgets(
      "shortmax",
      { SYNC_MAX_ITEMS: "50", SYNC_TIME_BUDGET_MS: "1000" },
      { maxNewEpisodeDramas: 3 },
    );
    expect(b.maxItems).toBe(50);
    expect(b.maxNewEpisodeDramas).toBe(3);
    expect(b.maxEpisodesPerDrama).toBe(120);
    expect(b.timeBudgetMs).toBe(1000);
  });
});

describe("classifyDeepFillKind", () => {
  it("marks empty new titles as new and missing rows as incomplete", () => {
    expect(
      classifyDeepFillKind({ isNewDrama: true, haveCount: 0, metaEpisodeCount: 0, fast: true }),
    ).toBe("new");
    expect(
      classifyDeepFillKind({ isNewDrama: false, haveCount: 0, metaEpisodeCount: 40, fast: true }),
    ).toBe("incomplete");
    expect(
      classifyDeepFillKind({ isNewDrama: false, haveCount: 10, metaEpisodeCount: 80, fast: true }),
    ).toBe("incomplete");
    expect(
      classifyDeepFillKind({ isNewDrama: false, haveCount: 80, metaEpisodeCount: 80, fast: true }),
    ).toBe("complete");
    expect(
      classifyDeepFillKind({ isNewDrama: false, haveCount: 80, metaEpisodeCount: 80, fast: false }),
    ).toBe("incomplete");
  });
});

describe("selectDeepFillCandidates", () => {
  it("prioritizes incomplete then new and respects the cap", () => {
    const candidates: DeepFillCandidate[] = [
      { providerDramaId: "a", kind: "complete" },
      { providerDramaId: "b", kind: "new" },
      { providerDramaId: "c", kind: "incomplete" },
      { providerDramaId: "d", kind: "new" },
      { providerDramaId: "e", kind: "incomplete" },
    ];
    expect(selectDeepFillCandidates(candidates, 3).map((c) => c.providerDramaId)).toEqual([
      "c",
      "e",
      "b",
    ]);
  });
});

describe("takeEpisodeInsertBatch", () => {
  it("returns only missing episode numbers up to the cap", () => {
    const nums = [1, 2, 3, 4, 5, 6];
    expect(takeEpisodeInsertBatch(nums, new Set([1, 2]), 2)).toEqual([3, 4]);
    expect(takeEpisodeInsertBatch(nums, new Set([1, 2, 3, 4, 5, 6]), 10)).toEqual([]);
  });
});

describe("isTimeBudgetExhausted", () => {
  it("trips when elapsed time reaches the budget", () => {
    expect(isTimeBudgetExhausted(1000, 500, 1499)).toBe(false);
    expect(isTimeBudgetExhausted(1000, 500, 1500)).toBe(true);
  });
});
