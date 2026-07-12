export type SyncBudgets = {
  maxItems: number;
  maxNewEpisodeDramas: number;
  maxEpisodesPerDrama: number;
  timeBudgetMs: number;
};

const LONGFORM = new Set(["wetv", "moviebox"]);

export function defaultSyncBudgets(providerCode: string): SyncBudgets {
  if (LONGFORM.has(providerCode)) {
    return {
      maxItems: 20,
      maxNewEpisodeDramas: 5,
      maxEpisodesPerDrama: 80,
      timeBudgetMs: 720_000,
    };
  }
  return {
    maxItems: 80,
    maxNewEpisodeDramas: 10,
    maxEpisodesPerDrama: 120,
    timeBudgetMs: 720_000,
  };
}

export function resolveSyncBudgets(
  providerCode: string,
  env: Record<string, string | undefined> = {},
  overrides: Partial<SyncBudgets> = {},
): SyncBudgets {
  const d = defaultSyncBudgets(providerCode);
  const num = (k: string, fallback: number) => {
    const v = env[k];
    if (v == null || v === "") return fallback;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    maxItems: overrides.maxItems ?? num("SYNC_MAX_ITEMS", d.maxItems),
    maxNewEpisodeDramas:
      overrides.maxNewEpisodeDramas ?? num("SYNC_MAX_NEW_EPISODE_DRAMAS", d.maxNewEpisodeDramas),
    maxEpisodesPerDrama:
      overrides.maxEpisodesPerDrama ?? num("SYNC_MAX_EPISODES_PER_DRAMA", d.maxEpisodesPerDrama),
    timeBudgetMs: overrides.timeBudgetMs ?? num("SYNC_TIME_BUDGET_MS", d.timeBudgetMs),
  };
}

export type DeepFillKind = "incomplete" | "new" | "complete";
export type DeepFillCandidate = { providerDramaId: string; kind: DeepFillKind };

export function classifyDeepFillKind(input: {
  isNewDrama: boolean;
  haveCount: number;
  metaEpisodeCount: number;
  fast: boolean;
}): DeepFillKind {
  if (input.haveCount === 0) return input.isNewDrama ? "new" : "incomplete";
  if (input.metaEpisodeCount > 0 && input.haveCount < input.metaEpisodeCount) return "incomplete";
  if (input.fast) return "complete";
  return "incomplete";
}

export function selectDeepFillCandidates(
  candidates: DeepFillCandidate[],
  maxNewEpisodeDramas: number,
): DeepFillCandidate[] {
  const rank = { incomplete: 0, new: 1, complete: 2 } as const;
  return [...candidates]
    .filter((c) => c.kind !== "complete")
    .sort((a, b) => rank[a.kind] - rank[b.kind])
    .slice(0, Math.max(0, maxNewEpisodeDramas));
}

export function takeEpisodeInsertBatch(
  episodeNumbers: number[],
  have: Set<number>,
  maxNew: number,
): number[] {
  const missing = episodeNumbers.filter((n) => !have.has(n)).sort((a, b) => a - b);
  return missing.slice(0, Math.max(0, maxNew));
}

export function isTimeBudgetExhausted(
  startedAtMs: number,
  timeBudgetMs: number,
  nowMs = Date.now(),
): boolean {
  return nowMs - startedAtMs >= timeBudgetMs;
}
