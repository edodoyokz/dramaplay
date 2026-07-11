import type { ProviderAdapter } from "@dramaplay/shared";

export type ProviderPreflightResult = {
  ok: boolean;
  provider: string;
  sampleTitle?: string;
  episodeCount?: number;
  streamType?: string;
  error?: string;
};

export async function providerPreflight(
  provider: string,
  adapter: Pick<ProviderAdapter, "fetchForYou" | "fetchTrending" | "fetchLatest" | "fetchVip" | "fetchDetail" | "fetchEpisodes" | "resolveStream">,
): Promise<ProviderPreflightResult> {
  try {
    const batches = await Promise.all([
      adapter.fetchLatest(),
      adapter.fetchForYou().then((r) => r.items),
      adapter.fetchTrending(),
      adapter.fetchVip(),
    ]);
    const samples = [
      ...new Map(batches.flatMap((batch) => batch.slice(0, 3)).map((x) => [x.providerDramaId, x])).values(),
    ];
    if (!samples.length) return { ok: false, provider, error: "list_empty" };

    let lastError = "unknown";
    for (const first of samples) {
      const detail = await adapter.fetchDetail(first.providerDramaId);
      if (!detail) {
        lastError = "detail_empty";
        continue;
      }

      const episodes = await adapter.fetchEpisodes(first.providerDramaId);
      if (!episodes.length) {
        lastError = "episodes_empty";
        continue;
      }

      const stream = await adapter.resolveStream(episodes[0].providerEpisodeId);
      if (!stream?.streamUrl) {
        lastError = "stream_empty";
        continue;
      }

      return {
        ok: true,
        provider,
        sampleTitle: first.title,
        episodeCount: episodes.length,
        streamType: stream.streamType,
      };
    }

    return { ok: false, provider, sampleTitle: samples[0].title, error: lastError };
  } catch (e: any) {
    return { ok: false, provider, error: e?.message ?? String(e) };
  }
}
