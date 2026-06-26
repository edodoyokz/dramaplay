import type {
  ProviderAdapter,
  ProviderDramaDetail,
  ProviderDramaSummary,
  ProviderEpisodeSummary,
  ProviderStreamSource,
} from "@dramaplay/shared";
import { SapimuBaseAdapter } from "../base";
import {
  BACKDROP_FIELDS,
  COUNT_FIELDS,
  EP_ID_FIELDS,
  EP_NUM_FIELDS,
  SYNOPSIS_FIELDS,
  findDetailRow,
  findEpisodeList,
  findStreamUrl,
  findSubtitleUrl,
  firstArray,
  pickNumber,
  pickString,
  rowToSummary,
  streamTypeFromUrl,
  unique,
} from "../base";
import type { SapimuCtx, SapimuProviderDef } from "./types";

type Row = Record<string, unknown>;

const q = (v: string) => encodeURIComponent(v);

function backdropOf(row: Row, def: SapimuProviderDef): string | undefined {
  return pickString(row, [...(def.fields.backdrop ?? []), ...BACKDROP_FIELDS]);
}

/** Summary with backdrop layered on top of the shared rowToSummary. */
function rowToSummaryV2(row: Row, def: SapimuProviderDef): ProviderDramaSummary {
  return { ...rowToSummary(row), backdropUrl: backdropOf(row, def) };
}

function rowsToSummariesV2(data: unknown, def: SapimuProviderDef): ProviderDramaSummary[] {
  return unique(
    firstArray(data).map((r) => rowToSummaryV2(r as Row, def)),
    (x) => x.providerDramaId,
  );
}

/**
 * Generic Sapimu provider adapter built from a SapimuProviderDef. Extraction
 * reuses the same global helpers as the legacy createSapimuAdapter so v2 and
 * legacy produce identical list/detail/stream output (parity for migration).
 * Provider-specific quirks (melolo episode filter, pinedrama dual-locale,
 * rawStream proxy) live in the definition config + optional overrides.
 */
export class SapimuPresetAdapter extends SapimuBaseAdapter implements ProviderAdapter {
  constructor(
    private def: SapimuProviderDef,
    baseUrl: string,
    token: string,
  ) {
    super(def.code, baseUrl, token);
  }

  private ctx(partial: Partial<SapimuCtx> = {}): SapimuCtx {
    return {
      code: this.def.code,
      get: <T>(path: string) => this.get<T>(path),
      fields: this.def.fields,
      ...partial,
    };
  }

  private async listFrom(path: string | undefined): Promise<ProviderDramaSummary[]> {
    const data = path ? await this.get<unknown>(path) : { data: [] };
    const override = this.def.overrides?.extractList;
    if (override) return this.normalizeList(override(data, this.ctx()));
    return rowsToSummariesV2(data, this.def);
  }

  async fetchForYou(_cursor?: string) {
    const path = this.def.endpoints.foryou ?? this.def.endpoints.latest ?? this.def.endpoints.trending;
    return { items: await this.listFrom(path) };
  }

  async fetchTrending() {
    return this.listFrom(this.def.endpoints.trending || undefined);
  }

  async fetchLatest() {
    return this.listFrom(this.def.endpoints.latest || undefined);
  }

  async fetchVip() {
    const paths = [this.def.endpoints.vip, ...(this.def.extra ?? [])].filter(Boolean) as string[];
    if (!paths.length) return [];
    const batches = await Promise.all(paths.map((p) => this.listFrom(p)));
    return unique(batches.flat(), (x) => x.providerDramaId);
  }

  async search(query: string) {
    const data = await this.get<unknown>(this.def.endpoints.search.replace("{q}", q(query)));
    const override = this.def.overrides?.extractList;
    if (override) return this.normalizeList(override(data, this.ctx()));
    return rowsToSummariesV2(data, this.def);
  }

  async fetchDetail(id: string): Promise<ProviderDramaDetail | null> {
    const data = await this.get<unknown>(this.def.endpoints.detail.replace("{id}", q(id)));
    const custom = this.def.overrides?.extractDetail?.(data, this.ctx());
    if (custom) return custom as ProviderDramaDetail;
    const row = findDetailRow(data);
    if (!row) return null;
    const episodes = await this.fetchEpisodes(id);
    return {
      ...rowToSummaryV2(row, this.def),
      synopsis: pickString(row, SYNOPSIS_FIELDS),
      episodeCount: episodes.length || pickNumber(row, COUNT_FIELDS),
      episodes,
    };
  }

  async fetchEpisodes(id: string): Promise<ProviderEpisodeSummary[]> {
    const custom = this.def.overrides?.extractEpisodes;
    if (custom) {
      const data = await this.get<unknown>((this.def.endpoints.episodes ?? this.def.endpoints.detail).replace("{id}", q(id)));
      return custom(data, this.ctx()) ?? [];
    }
    const path = (this.def.endpoints.episodes ?? this.def.endpoints.detail).replace("{id}", q(id));
    const data = await this.get<unknown>(path);
    const list = findEpisodeList(data);
    if (list.length) {
      return list.map((e, i) => {
        const pickedNum = pickNumber(e, EP_NUM_FIELDS);
        const num = pickedNum && pickedNum > 0 ? pickedNum : i + 1;
        const playParam = pickString(e, this.def.episodePlayField ?? []) ?? String(num);
        return {
          providerEpisodeId: `${id}:${playParam}`,
          episodeNumber: num,
          title: pickString(e, ["title", "name", "chapter_name", "book_sub_title"]) ?? `Episode ${num}`,
        };
      });
    }
    // Fallback: derive synthetic episodes from the detail's count field.
    const row = findDetailRow(data) ?? ({} as Row);
    const total = pickNumber(row, COUNT_FIELDS) ?? 0;
    return Array.from({ length: total }, (_, i) => ({
      providerEpisodeId: `${id}:${i + 1}`,
      episodeNumber: i + 1,
      title: `Episode ${i + 1}`,
    }));
  }

  async resolveStream(episodeId: string): Promise<ProviderStreamSource | null> {
    const [id, ep = "1"] = episodeId.split(":");
    const epNum = parseInt(ep, 10);
    const ctx = this.ctx({ episodeId, episodeNumber: epNum });
    const playPath = this.def.endpoints.play.replace("{id}", q(id)).replace("{ep}", q(ep));

    if (this.def.rawStream) {
      return {
        streamUrl: `/proxy/sapimu-stream?path=${encodeURIComponent(playPath)}`,
        streamType: "m3u8",
      };
    }

    const data = await this.get<unknown>(playPath);
    const payload = this.def.overrides?.selectStreamPayload?.(data, ctx) ?? data;

    if (this.def.overrides?.normalizeStream) {
      return this.def.overrides.normalizeStream(payload, ctx) ?? null;
    }

    const url = findStreamUrl(payload);
    if (!url) return null;
    const subtitleUrl = this.def.overrides?.extractSubtitle?.(data, ctx)?.url ?? findSubtitleUrl(payload);
    return { streamUrl: url, streamType: streamTypeFromUrl(url), subtitleUrl };
  }

  /** Coerce an override-provided list into normalized summaries. */
  private normalizeList(items: unknown[]): ProviderDramaSummary[] {
    return unique(
      items.filter((x): x is Row => !!x && typeof x === "object").map((r) => rowToSummaryV2(r, this.def)),
      (x) => x.providerDramaId,
    );
  }
}
