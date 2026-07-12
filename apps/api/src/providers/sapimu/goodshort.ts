import type {
  ProviderDramaDetail,
  ProviderDramaSummary,
  ProviderEpisodeSummary,
  ProviderStreamSource,
} from "@dramaplay/shared";
import { BaseProviderAdapter } from "../base";

type Row = Record<string, unknown>;

function s(v: unknown) {
  return typeof v === "string" && v ? v : typeof v === "number" ? String(v) : undefined;
}

function n(v: unknown) {
  return typeof v === "number" ? v : Number(v) || undefined;
}

function parseEps(title: string) {
  const m = title.match(/^0*(\d+)/);
  return m ? Number(m[1]) : Number(title) || 0;
}

const CHANNEL_ID = 562; // Indonesian

export class GoodShortAdapter extends BaseProviderAdapter {
  declare code: string;
  private chapterCache = new Map<string, Row[]>();

  constructor(code: string, baseUrl: string, private token: string) {
    super(baseUrl);
    this.code = code;
  }

  private get<T>(path: string) {
    return this.getJson<T>(path, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "User-Agent": "Mozilla/5.0",
      },
    });
  }

  async fetchForYou() {
    return { items: await this.fetchLatest() };
  }

  async fetchTrending() {
    return this.fetchHome();
  }

  async fetchLatest() {
    return this.fetchHome();
  }

  async fetchVip() {
    return this.fetchHome();
  }

  private async fetchHome(): Promise<ProviderDramaSummary[]> {
    const seen = new Set<string>();
    const items: ProviderDramaSummary[] = [];
    // Collect unique dramas across all records/items
    const data = await this.get<{
      data?: { records?: Row[] };
    }>(`/goodshort/api/v1/home?channelId=${CHANNEL_ID}&page=1&pageSize=50`);
    for (const r of data.data?.records ?? []) {
      for (const item of (r as Row).items as Row[] ?? []) {
        const id = s(item.bookId);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        items.push({
          providerDramaId: id,
          title: s(item.bookName) ?? s(item.name) ?? "",
          posterUrl: s(item.image) ?? s(item.cover),
          genres: Array.isArray(item.labels) ? (item.labels as string[]) : undefined,
        });
      }
    }
    return items;
  }

  async search(query: string): Promise<ProviderDramaSummary[]> {
    const data = await this.get<{
      data?: { searchResult?: { records?: Row[] } };
    }>(`/goodshort/api/v1/search?q=${encodeURIComponent(query)}`);
    const list = data.data?.searchResult?.records ?? data.data?.searchResult as Row[] ?? [];
    return list.map((it: Row) => ({
      providerDramaId: s(it.bookId) ?? "",
      title: s(it.bookName) ?? "",
      posterUrl: s(it.cover),
      genres: Array.isArray(it.labels) ? (it.labels as string[]) : undefined,
    }));
  }

  async fetchDetail(providerDramaId: string): Promise<ProviderDramaDetail | null> {
    const data = await this.get<{
      data?: { book?: Row };
    }>(`/goodshort/api/v1/book/${encodeURIComponent(providerDramaId)}`);
    const b = data.data?.book;
    if (!b) return null;
    return {
      providerDramaId: s(b.bookId) ?? providerDramaId,
      title: s(b.bookName) ?? "",
      posterUrl: s(b.cover),
      synopsis: s(b.introduction),
      genres: Array.isArray(b.labels) ? (b.labels as string[]) : undefined,
      episodeCount: n(b.chapterCount),
    };
  }

  async fetchEpisodes(providerDramaId: string): Promise<ProviderEpisodeSummary[]> {
    const data = await this.get<{
      data?: { list?: Row[] };
    }>(`/goodshort/api/v1/chapters/${encodeURIComponent(providerDramaId)}`);
    return (data.data?.list ?? []).map((ch: Row, i: number) => ({
      providerEpisodeId: `${providerDramaId}:${s(ch.id) ?? ""}`,
      seasonNumber: 1,
      episodeNumber: parseEps(s(ch.chapterName) ?? "") || i + 1,
      title: s(ch.chapterName),
      thumbnailUrl: s(ch.image),
      durationSeconds: n(ch.playTime),
    }));
  }

  // providerEpisodeId is encoded as "bookId:chapterId".
  // Note: the /play endpoint returns acfs1.goodreels.com URLs without tokens,
  // which are blocked from Cloudflare Workers IP ranges. Instead, use the
  // /chapters endpoint that returns v3-akm.goodreels.com URLs with signed
  // tokens that work from anywhere.
  async resolveStream(providerEpisodeId: string): Promise<ProviderStreamSource | null> {
    const parts = providerEpisodeId.split(":");
    const bookId = parts[0];
    const chapterId = parts[1];
    // Use cached chapters if available, otherwise fetch
    let chapters = this.chapterCache.get(bookId);
    if (!chapters) {
      const data = await this.get<{
        data?: { list?: Row[] };
      }>(`/goodshort/api/v1/chapters/${bookId}`);
      chapters = data.data?.list ?? [];
      // ponytail: in-memory cache, per-request lifetime; add when needed across requests
      this.chapterCache.set(bookId, chapters);
    }
    const chapter = chapters.find((ch: Row) => String(ch.id) === chapterId);
    if (!chapter) return null;
    const multi = chapter.multiVideos as Row[] | undefined;
    const cdn = chapter.cdnList as Row[] | undefined;
    const best = (multi?.[0]?.filePath ?? cdn?.[0]?.videoPath) as string | undefined;
    if (!best) return null;
    return {
      streamUrl: best,
      streamType: "m3u8",
    };
  }
}
