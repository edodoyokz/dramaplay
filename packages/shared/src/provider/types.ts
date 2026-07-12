export type ContentType = "shortform" | "longform";
export type MediaType = "movie" | "series";

export function resolveContentKind(input: {
  contentType?: string | null;
  mediaType?: string | null;
  providerContentType?: string | null;
  episodeCount?: number | null;
}): { contentType: ContentType; mediaType?: MediaType } {
  const contentType: ContentType =
    input.contentType === "longform" || input.providerContentType === "longform"
      ? "longform"
      : "shortform";
  if (contentType !== "longform") return { contentType };
  if (input.mediaType === "movie" || input.mediaType === "series") {
    return { contentType, mediaType: input.mediaType };
  }
  return {
    contentType,
    mediaType: (input.episodeCount ?? 0) > 1 ? "series" : "movie",
  };
}

export interface ProviderDramaSummary {
  providerDramaId: string;
  title: string;
  posterUrl?: string;
  backdropUrl?: string;
  genres?: string[];
  country?: string;
  year?: number;
  contentType?: ContentType;
  mediaType?: MediaType;
}

export interface ProviderDramaDetail extends ProviderDramaSummary {
  originalTitle?: string;
  synopsis?: string;
  language?: string;
  tags?: string[];
  episodeCount?: number;
  episodes?: ProviderEpisodeSummary[];
}

export interface ProviderEpisodeSummary {
  providerEpisodeId: string;
  seasonNumber: number;
  episodeNumber: number;
  title?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}

export interface ProviderStreamSource {
  streamUrl: string;
  streamType: "mp4" | "m3u8" | "other";
  quality?: string;
  subtitleUrl?: string;
  subtitleLanguage?: string;
  expiresAt?: Date;
}

export interface ProviderAdapter {
  code: string;
  fetchForYou(cursor?: string): Promise<{ items: ProviderDramaSummary[]; nextCursor?: string }>;
  fetchTrending(): Promise<ProviderDramaSummary[]>;
  fetchLatest(): Promise<ProviderDramaSummary[]>;
  fetchVip(): Promise<ProviderDramaSummary[]>;
  search(query: string): Promise<ProviderDramaSummary[]>;
  fetchDetail(providerDramaId: string): Promise<ProviderDramaDetail | null>;
  fetchEpisodes(providerDramaId: string): Promise<ProviderEpisodeSummary[]>;
  resolveStream(providerEpisodeId: string): Promise<ProviderStreamSource | null>;
}
