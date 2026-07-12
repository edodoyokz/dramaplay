import { describe, expect, it } from "vitest";
import {
  episodeKey,
  selectEpisodeRefreshCandidates,
  takeMissingEpisodes,
} from "../src/sync/episodes";

describe("episodeKey", () => {
  it("distinguishes S1E1 from S2E1", () => {
    expect(episodeKey({ seasonNumber: 1, episodeNumber: 1 })).toBe("1:1");
    expect(episodeKey({ seasonNumber: 2, episodeNumber: 1 })).toBe("2:1");
  });
});

describe("takeMissingEpisodes", () => {
  it("keeps a new season with a repeated episode number", () => {
    const incoming = [
      { providerEpisodeId: "subject:1:1", seasonNumber: 1, episodeNumber: 1 },
      { providerEpisodeId: "subject:2:1", seasonNumber: 2, episodeNumber: 1 },
    ];
    expect(
      takeMissingEpisodes(incoming, [{ seasonNumber: 1, episodeNumber: 1 }], 80),
    ).toEqual([incoming[1]]);
  });
});

describe("selectEpisodeRefreshCandidates", () => {
  const candidates = [
    { providerDramaId: "complete-series", kind: "complete" as const },
  ];

  it("discovers episodes for complete MovieBox titles during fast sync", () => {
    expect(
      selectEpisodeRefreshCandidates(candidates, 5, "moviebox", true),
    ).toEqual(candidates);
  });

  it("does not alter complete-title behavior for other providers", () => {
    expect(selectEpisodeRefreshCandidates(candidates, 5, "wetv", true)).toEqual(
      [],
    );
  });

  it("never exceeds the drama cap", () => {
    const mixed = [
      { providerDramaId: "a", kind: "incomplete" as const },
      { providerDramaId: "b", kind: "new" as const },
      { providerDramaId: "c", kind: "complete" as const },
      { providerDramaId: "d", kind: "complete" as const },
    ];
    expect(
      selectEpisodeRefreshCandidates(mixed, 2, "moviebox", true),
    ).toHaveLength(2);
  });
});
