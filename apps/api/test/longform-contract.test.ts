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
      episodeNumber: 1,
      durationSeconds: 1285,
    };

    expect(summary.contentType).toBe("longform");
    expect(detail.mediaType).toBe("series");
    expect(episode.providerEpisodeId).toContain(":");
  });
});
