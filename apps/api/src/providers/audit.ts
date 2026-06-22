import type { ProviderStreamSource } from "@dramaplay/shared";

export interface ProviderAuditInput {
  provider: string;
  title?: string;
  posterUrl?: string;
  episodeCount?: number;
  streamUrl?: string;
  streamType?: ProviderStreamSource["streamType"];
  videoCodec?: string;
  audioCodec?: string;
  contentType?: string;
  nosniff?: boolean;
}

export interface ProviderAuditResult {
  provider: string;
  passed: boolean;
  failures: string[];
}

export function assessProviderAudit(input: ProviderAuditInput): ProviderAuditResult {
  const failures: string[] = [];
  if (!input.title) failures.push("title_missing");
  if (!input.posterUrl) failures.push("poster_missing");
  if (!input.episodeCount || input.episodeCount < 1) failures.push("episodes_missing");
  if (!input.streamUrl) failures.push("stream_missing");

  const video = input.videoCodec?.toLowerCase();
  if (video && (video.includes("hevc") || video.includes("h265") || video.includes("h.265"))) {
    failures.push("video_codec_not_browser_safe");
  }

  const ct = input.contentType?.toLowerCase() ?? "";
  if (input.nosniff && ct.startsWith("text/plain")) failures.push("bad_media_content_type");

  return { provider: input.provider, passed: failures.length === 0, failures };
}
