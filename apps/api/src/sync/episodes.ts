import type { ProviderEpisodeSummary } from "@dramaplay/shared";
import {
  selectDeepFillCandidates,
  type DeepFillCandidate,
} from "./budget";

export type EpisodeIdentity = {
  seasonNumber: number;
  episodeNumber: number;
};

export function episodeKey(episode: EpisodeIdentity) {
  return `${episode.seasonNumber}:${episode.episodeNumber}`;
}

export function takeMissingEpisodes(
  incoming: ProviderEpisodeSummary[],
  existing: EpisodeIdentity[],
  maxNew: number,
) {
  const have = new Set(existing.map(episodeKey));
  return incoming
    .filter((episode) => !have.has(episodeKey(episode)))
    .sort(
      (a, b) =>
        a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber,
    )
    .slice(0, Math.max(0, maxNew));
}

export function selectEpisodeRefreshCandidates<T extends DeepFillCandidate>(
  candidates: T[],
  maxDramas: number,
  providerCode: string,
  fast: boolean,
): T[] {
  const selected = selectDeepFillCandidates(candidates, maxDramas) as T[];
  if (!fast || providerCode !== "moviebox" || selected.length >= maxDramas) {
    return selected;
  }

  const selectedIds = new Set(selected.map((item) => item.providerDramaId));
  // ponytail: refresh complete MovieBox titles visible in the bounded shelf;
  // add a persisted rotation cursor only if production evidence shows starvation.
  return [
    ...selected,
    ...candidates
      .filter(
        (item) =>
          item.kind === "complete" && !selectedIds.has(item.providerDramaId),
      )
      .slice(0, maxDramas - selected.length),
  ];
}
