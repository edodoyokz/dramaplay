import { SapimuBaseAdapter, firstArray, s, n, unique, findStreamUrl, streamTypeFromUrl } from "./base";
import type { ProviderDramaDetail, ProviderDramaSummary, ProviderEpisodeSummary } from "@dramaplay/shared";

type Row = Record<string, unknown>;

function toSummary(row: Row): ProviderDramaSummary {
  const tag = Array.isArray(row.tag) ? row.tag.map(String) : [];
  const ctags = Array.isArray(row.content_tags) ? row.content_tags.map(String) : [];
  return {
    providerDramaId: String(row.key ?? ""),
    title: String(row.title ?? "Untitled"),
    posterUrl: s(row.cover ?? row.image),
    genres: tag.length ? tag : ctags.length ? ctags : undefined,
  };
}

function summaries(data: unknown): ProviderDramaSummary[] {
  return unique(firstArray(data).map((item) => toSummary(item as Row)), (x) => x.providerDramaId);
}

export class SapimuDramaWaveAdapter extends SapimuBaseAdapter {
  async fetchForYou(_cursor?: string) {
    return { items: summaries(await this.get<Row>("/dramawave/api/v1/feed/new?lang=id-ID")) };
  }

  async fetchTrending() {
    return summaries(await this.get<Row>("/dramawave/api/v1/feed/popular?lang=id-ID"));
  }

  async fetchLatest() {
    return summaries(await this.get<Row>("/dramawave/api/v1/feed/new?lang=id-ID"));
  }

  async fetchVip() {
    return summaries(await this.get<Row>("/dramawave/api/v1/feed/vip?lang=id-ID"));
  }

  async search(query: string) {
    return summaries(await this.get<Row>(`/dramawave/api/v1/search?q=${encodeURIComponent(query)}&limit=20`));
  }

  async fetchDetail(id: string): Promise<ProviderDramaDetail | null> {
    const data = await this.get<Row>(`/dramawave/api/v1/dramas/${encodeURIComponent(id)}?lang=id-ID`);
    const d = (data as Row).data as Row | undefined;
    if (!d) return null;
    const summary = toSummary(d);
    return {
      ...summary,
      synopsis: s(d.desc),
      episodes: await this.fetchEpisodes(id),
    };
  }

  async fetchEpisodes(id: string): Promise<ProviderEpisodeSummary[]> {
    const data = await this.get<Row>(`/dramawave/api/v1/dramas/${encodeURIComponent(id)}?lang=id-ID`);
    const d = (data as Row).data as Row | undefined;
    const total = n(d?.episodes) ?? 0;
    return Array.from({ length: total }, (_, i) => ({
      providerEpisodeId: `${id}:${i + 1}`,
      episodeNumber: i + 1,
      title: `Episode ${i + 1}`,
    }));
  }

  async resolveStream(episodeId: string) {
    const [id, ep = "1"] = episodeId.split(":");
    const data = await this.get<Row>(
      `/dramawave/api/v1/dramas/${encodeURIComponent(id)}/play/${encodeURIComponent(ep)}?lang=id-ID`
    );
    const url = findStreamUrl((data as Row).data);
    if (!url) return null;
    return { streamUrl: url, streamType: streamTypeFromUrl(url) };
  }
}
