import type { ContentType, MediaType } from "@dramaplay/shared";

export function titlePath(slug: string, contentType?: ContentType | string | null): string {
  return contentType === "longform" ? `/title/${slug}` : `/drama/${slug}`;
}

export function watchPath(
  slug: string,
  episodeNumber: number,
  contentType?: ContentType | string | null,
): string {
  return contentType === "longform"
    ? `/title/${slug}/watch/${episodeNumber}`
    : `/watch/${slug}/${episodeNumber}`;
}

export function mediaTypeLabel(mediaType?: MediaType | string | null): string | null {
  if (mediaType === "movie") return "Film";
  if (mediaType === "series") return "Serial";
  return null;
}
