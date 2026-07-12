import { describe, expect, it } from "vitest";
import type {
  ProviderDramaDetail,
  ProviderDramaSummary,
  ProviderEpisodeSummary,
} from "@dramaplay/shared";

describe("longform provider contracts", () => {
  it("allows long-form markers on summary/detail/episode shapes", () => {
    const summary: ProviderDramaSummary = {
      providerDramaId: "wu7vz4vgfi8ugan",
      title: "Dunia Roh 2",
      contentType: "longform",
      mediaType: "series",
    };
    const detail: ProviderDramaDetail = {
      ...summary,
      synopsis: "synopsis",
      episodeCount: 161,
    };
    const episode: ProviderEpisodeSummary = {
      providerEpisodeId: "wu7vz4vgfi8ugan:j00467e65u4",
      seasonNumber: 1,
      episodeNumber: 1,
      durationSeconds: 1285,
    };
    const multiSeason: ProviderEpisodeSummary = {
      providerEpisodeId: "785:2:1",
      seasonNumber: 2,
      episodeNumber: 1,
    };

    expect(summary.contentType).toBe("longform");
    expect(detail.mediaType).toBe("series");
    expect(episode).toMatchObject({ seasonNumber: 1, episodeNumber: 1 });
    expect(multiSeason).toMatchObject({ seasonNumber: 2, episodeNumber: 1 });
  });
});

describe("provider shelf contracts", () => {
  it("carries ordered shelf membership on a long-form summary", () => {
    const shelf: import("@dramaplay/shared").ProviderShelfMembership = {
      code: "1001",
      name: "Untukmu",
      position: 0,
    };
    expect(shelf.code).toBe("1001");
    expect(shelf.name).toBe("Untukmu");
    expect(shelf.position).toBe(0);
  });

  it("lets one title belong to multiple ordered shelves without weakening content/media types", () => {
    const summary: ProviderDramaSummary = {
      providerDramaId: "wu7vz4vgfi8ugan",
      title: "Dunia Roh 2",
      contentType: "longform",
      mediaType: "series",
      shelves: [
        { code: "popular", name: "Popular", position: 0 },
        { code: "top100", name: "TOP100", position: 4 },
      ],
    };
    expect(summary.contentType).toBe("longform");
    expect(summary.mediaType).toBe("series");
    expect(summary.shelves).toHaveLength(2);
    expect(summary.shelves?.[0].position).toBe(0);
    expect(summary.shelves?.[1].position).toBe(4);
  });
});
