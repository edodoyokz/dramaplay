import {
  createDb,
  providers,
  syncLogs,
  dramas,
  dramaProviders,
  episodes,
  episodeProviders,
} from "@dramaplay/db";
import { and, eq, sql } from "drizzle-orm";
import { buildProviders } from "../providers/registry";
import { slugifyTitle } from "../lib/slug";
import type { ProviderDramaSummary, ProviderEpisodeSummary } from "@dramaplay/shared";
import {
  classifyDeepFillKind,
  isTimeBudgetExhausted,
  resolveSyncBudgets,
  selectDeepFillCandidates,
  takeEpisodeInsertBatch,
  type DeepFillKind,
} from "./budget";

/**
 * Slugify a title and prefix it with the provider code so the same title
 * from different providers does not overwrite each other.
 */
export function providerSlug(providerCode: string, title: string): string {
  return `${providerCode}-${slugifyTitle(title)}`;
}

interface SyncResult {
  dramaNew: number;
  dramaUpdated: number;
  episodeNew: number;
  errorCount: number;
  deepFilled?: number;
  deepFillSkippedBudget?: number;
  episodesCapped?: number;
}

type PendingDeepFill = {
  providerDramaId: string;
  kind: DeepFillKind;
  dramaId: string;
  item: ProviderDramaSummary;
};

async function shelfOrEmpty(
  label: string,
  run: () => Promise<ProviderDramaSummary[]>,
): Promise<ProviderDramaSummary[]> {
  try {
    return await run();
  } catch (e) {
    // Upstream provider APIs flap (503 maintenance / 500 CDN). One shelf must
    // not abort the whole provider sync — empty shelf is partial, not fatal.
    console.error(`[sync] shelf ${label}: ${e}`);
    return [];
  }
}

export async function fetchAllProviderSummaries(
  adapter: ReturnType<typeof buildProviders>[string],
  searchKeywords: string[] = [],
): Promise<ProviderDramaSummary[]> {
  const batches = await Promise.all([
    shelfOrEmpty("forYou", async () => (await adapter.fetchForYou()).items),
    shelfOrEmpty("trending", () => adapter.fetchTrending()),
    shelfOrEmpty("latest", () => adapter.fetchLatest()),
    shelfOrEmpty("vip", () => adapter.fetchVip()),
    ...searchKeywords.map((q) => shelfOrEmpty(`search:${q}`, () => adapter.search(q))),
  ]);

  return [
    ...new Map(
      batches
        .flat()
        .filter((x) => x.providerDramaId)
        .map((x) => [x.providerDramaId, x]),
    ).values(),
  ];
}

export async function warmPosterUrls(
  consumerUrl: string,
  items: Pick<ProviderDramaSummary, "posterUrl">[],
  fetcher: typeof fetch = fetch,
): Promise<{ warmed: number; failed: number }> {
  const urls = [...new Set(items.map((item) => item.posterUrl).filter((url): url is string => Boolean(url)))];
  let warmed = 0;
  let failed = 0;
  for (const url of urls) {
    try {
      const response = await fetcher(`${consumerUrl.replace(/\/$/, "")}/img?u=${encodeURIComponent(url)}`);
      if (response.ok) warmed++;
      else failed++;
    } catch {
      failed++;
    }
  }
  return { warmed, failed };
}

export async function syncProvider(
  dbUrl: string,
  providerCode: string,
  providerBaseUrl: string,
  providerToken?: string,
  options: {
    fast?: boolean;
    searchKeywords?: string[];
    maxItems?: number;
    consumerUrl?: string;
    maxNewEpisodeDramas?: number;
    maxEpisodesPerDrama?: number;
    timeBudgetMs?: number;
    /** Optional env map for budget knobs (Node process.env from CLI). */
    env?: Record<string, string | undefined>;
  } = {},
): Promise<SyncResult> {
  const db = createDb(dbUrl);
  const adapters = buildProviders(providerBaseUrl, providerToken);
  const adapter = adapters[providerCode];
  if (!adapter) throw new Error(`unknown provider ${providerCode}`);

  const startedAt = new Date();
  const budgets = resolveSyncBudgets(providerCode, options.env ?? {}, {
    maxItems: options.maxItems,
    maxNewEpisodeDramas: options.maxNewEpisodeDramas,
    maxEpisodesPerDrama: options.maxEpisodesPerDrama,
    timeBudgetMs: options.timeBudgetMs,
  });
  const result: SyncResult = {
    dramaNew: 0,
    dramaUpdated: 0,
    episodeNew: 0,
    errorCount: 0,
    deepFilled: 0,
    deepFillSkippedBudget: 0,
    episodesCapped: 0,
  };

  const [providerRow] = await db.select().from(providers).where(eq(providers.code, providerCode));
  if (!providerRow) throw new Error("provider not registered");

  try {
    const items: ProviderDramaSummary[] = await fetchAllProviderSummaries(adapter, options.searchKeywords);
    const selectedItems = items.slice(0, budgets.maxItems);
    if (options.consumerUrl) {
      const posters = await warmPosterUrls(options.consumerUrl, selectedItems);
      console.log(` posters: ${posters.warmed} cached, ${posters.failed} failed`);
      result.errorCount += posters.failed;
    }

    const pending: PendingDeepFill[] = [];

    for (const item of selectedItems) {
      try {
        const slug = providerSlug(providerCode, item.title);
        const existing = await db.select().from(dramas).where(eq(dramas.slug, slug)).limit(1);
        let dramaId: string;
        let metaEpisodeCount = 0;
        let isNewDrama = false;

        if (existing.length > 0) {
          metaEpisodeCount = existing[0].episodeCount ?? 0;
          const [updated] = await db
            .update(dramas)
            .set({ title: item.title, posterUrl: item.posterUrl, backdropUrl: item.backdropUrl, updatedAt: new Date() })
            .where(eq(dramas.id, existing[0].id))
            .returning();
          dramaId = updated.id;
          result.dramaUpdated++;
        } else {
          const [created] = await db
            .insert(dramas)
            .values({
              slug,
              title: item.title,
              posterUrl: item.posterUrl,
              genres: item.genres ?? [],
              country: item.country,
              year: item.year,
            })
            .returning();
          dramaId = created.id;
          isNewDrama = true;
          result.dramaNew++;
        }

        const providerMeta = {
          contentType: item.contentType ?? "shortform",
          mediaType: item.mediaType,
        };
        await db
          .insert(dramaProviders)
          .values({
            dramaId,
            providerId: providerRow.id,
            providerDramaId: item.providerDramaId,
            isPrimary: true,
            metadata: providerMeta,
          })
          .onConflictDoUpdate({
            target: [dramaProviders.dramaId, dramaProviders.providerId],
            set: {
              providerDramaId: item.providerDramaId,
              metadata: providerMeta,
            },
          });

        const [countRow] = await db
          .select({ c: sql<number>`count(*)::int` })
          .from(episodes)
          .where(eq(episodes.dramaId, dramaId));
        const haveCount = Number(countRow?.c ?? 0);
        const kind = classifyDeepFillKind({
          isNewDrama,
          haveCount,
          metaEpisodeCount,
          fast: Boolean(options.fast),
        });
        pending.push({ providerDramaId: item.providerDramaId, kind, dramaId, item });
      } catch (e) {
        console.error(`[sync] ${providerCode}/${item.providerDramaId}: ${e}`);
        result.errorCount++;
      }
    }

    const selectedDeep = selectDeepFillCandidates(pending, budgets.maxNewEpisodeDramas);
    const byId = new Map(pending.map((p) => [p.providerDramaId, p]));
    const startedMs = startedAt.getTime();

    for (const cand of selectedDeep) {
      if (isTimeBudgetExhausted(startedMs, budgets.timeBudgetMs)) {
        result.deepFillSkippedBudget = (result.deepFillSkippedBudget ?? 0) + 1;
        continue;
      }
      const work = byId.get(cand.providerDramaId);
      if (!work) continue;
      try {
        const eps: ProviderEpisodeSummary[] = await adapter.fetchEpisodes(work.item.providerDramaId);
        if (!eps.length) {
          result.deepFilled = (result.deepFilled ?? 0) + 1;
          continue;
        }

        const existingEps = await db
          .select({ n: episodes.episodeNumber })
          .from(episodes)
          .where(eq(episodes.dramaId, work.dramaId));
        const have = new Set(existingEps.map((e) => e.n));
        const batchNums = takeEpisodeInsertBatch(
          eps.map((e) => e.episodeNumber),
          have,
          budgets.maxEpisodesPerDrama,
        );
        const batchSet = new Set(batchNums);
        const toInsert = eps.filter((e) => batchSet.has(e.episodeNumber));
        const missingTotal = eps.filter((e) => !have.has(e.episodeNumber)).length;
        if (missingTotal > toInsert.length) {
          result.episodesCapped = (result.episodesCapped ?? 0) + 1;
        }

        let inserted: { id: string; episodeNumber: number }[] = [];
        if (toInsert.length) {
          inserted = await db
            .insert(episodes)
            .values(
              toInsert.map((ep) => ({
                dramaId: work.dramaId,
                episodeNumber: ep.episodeNumber,
                title: ep.title,
                thumbnailUrl: ep.thumbnailUrl,
                durationSeconds: ep.durationSeconds,
              })),
            )
            .returning({ id: episodes.id, episodeNumber: episodes.episodeNumber });
          result.episodeNew += inserted.length;
          await db
            .insert(episodeProviders)
            .values(
              inserted.map((row) => ({
                episodeId: row.id,
                providerId: providerRow.id,
                providerEpisodeId:
                  eps.find((e) => e.episodeNumber === row.episodeNumber)?.providerEpisodeId ??
                  `${work.item.providerDramaId}:${row.episodeNumber}`,
                isPrimary: true,
              })),
            )
            .onConflictDoNothing();
        }

        // Keep meta count at the provider total when capped so the next run
        // still sees have < want and prioritizes the remainder.
        const actual = have.size + toInsert.length;
        const knownTotal = Math.max(actual, eps.length);
        await db
          .update(dramas)
          .set({ episodeCount: knownTotal, updatedAt: new Date() })
          .where(eq(dramas.id, work.dramaId));

        const threshold = Math.max(2, Math.ceil(knownTotal * 0.1));
        await db
          .update(episodes)
          .set({ accessType: "free" })
          .where(
            and(eq(episodes.dramaId, work.dramaId), sql`${episodes.episodeNumber} <= ${threshold}`),
          );
        await db
          .update(episodes)
          .set({ accessType: "vip" })
          .where(
            and(eq(episodes.dramaId, work.dramaId), sql`${episodes.episodeNumber} > ${threshold}`),
          );

        // Subtitles: watch write-through only (no resolveStream in daily sync).
        result.deepFilled = (result.deepFilled ?? 0) + 1;
      } catch (e) {
        console.error(`[sync] deep-fill ${providerCode}/${cand.providerDramaId}: ${e}`);
        result.errorCount++;
      }
    }

    // Count candidates not selected because of maxNewEpisodeDramas.
    const selectedIds = new Set(selectedDeep.map((c) => c.providerDramaId));
    const notSelected = pending.filter((p) => p.kind !== "complete" && !selectedIds.has(p.providerDramaId)).length;
    result.deepFillSkippedBudget = (result.deepFillSkippedBudget ?? 0) + notSelected;

    console.log(
      `[sync] ${providerCode}: deepFilled=${result.deepFilled} skippedBudget=${result.deepFillSkippedBudget} episodesCapped=${result.episodesCapped}`,
    );

    const budgetLeftWork = (result.deepFillSkippedBudget ?? 0) > 0;
    const status =
      result.errorCount === 0 && !budgetLeftWork ? "success" : result.errorCount > 0 || budgetLeftWork ? "partial" : "success";

    await db
      .update(providers)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: status,
      })
      .where(eq(providers.id, providerRow.id));

    await db.insert(syncLogs).values({
      providerId: providerRow.id,
      jobType: "latest",
      triggerType: "cron",
      status,
      dramaNew: result.dramaNew,
      dramaUpdated: result.dramaUpdated,
      episodeNew: result.episodeNew,
      errorCount: result.errorCount,
      startedAt,
      finishedAt: new Date(),
    });

    return result;
  } catch (e) {
    result.errorCount++;
    await db.insert(syncLogs).values({
      providerId: providerRow.id,
      jobType: "latest",
      triggerType: "cron",
      status: "failed",
      dramaNew: result.dramaNew,
      dramaUpdated: result.dramaUpdated,
      episodeNew: result.episodeNew,
      errorCount: result.errorCount,
      errorDetail: String(e),
      startedAt,
      finishedAt: new Date(),
    });
    throw e;
  }
}
