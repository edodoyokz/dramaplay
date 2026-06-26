import type {
  ProviderDramaDetail,
  ProviderEpisodeSummary,
  ProviderStreamSource,
} from "@dramaplay/shared";

export type SubtitlePolicy = "external" | "hardsub" | "mixed" | "unknown";

export interface ProviderSubtitle {
  url: string;
  language: string; // "id"
  format?: "vtt" | "srt";
}

export interface FieldMap {
  id: string[];
  title: string[];
  poster: string[];
  backdrop?: string[];
  episodeNumber?: string[];
}

export interface EndpointMap {
  trending: string;
  latest: string;
  foryou: string;
  vip?: string;
  search: string;
  detail: string;
  /** Separate episodes-list endpoint ({id}). If omitted, episodes are read from the detail response. */
  episodes?: string;
  play: string;
}

export interface SapimuCtx {
  code: string;
  get<T>(path: string): Promise<T>;
  episodeId?: string;
  episodeNumber?: number;
  fields: FieldMap;
}

export interface SapimuOverrides {
  extractList?(data: unknown, ctx: SapimuCtx): unknown[];
  extractDetail?(data: unknown, ctx: SapimuCtx): Partial<ProviderDramaDetail> | undefined;
  extractEpisodes?(data: unknown, ctx: SapimuCtx): ProviderEpisodeSummary[] | undefined;
  selectStreamPayload?(data: unknown, ctx: SapimuCtx): unknown;
  normalizeStream?(data: unknown, ctx: SapimuCtx): ProviderStreamSource | undefined;
  extractSubtitle?(data: unknown, ctx: SapimuCtx): ProviderSubtitle | undefined;
}

export interface SapimuProviderDef {
  code: string;
  endpoints: EndpointMap;
  fields: FieldMap;
  subtitlePolicy: SubtitlePolicy;
  /** Extra list endpoints merged into fetchVip() for providers with several shelves. */
  extra?: string[];
  /** If true, play returns a raw m3u8 manifest behind auth; resolve returns a proxy URL. */
  rawStream?: boolean;
  /** Field(s) used as the per-episode play param (default: episode number). e.g. ["chapter_id"], ["fileId"]. */
  episodePlayField?: string[];
  overrides?: SapimuOverrides;
}
