import {
  createDb,
  providers,
  syncLogs,
  dramas,
  dramaProviders,
  episodes,
  episodeProviders,
  subtitles,
} from "@dramaplay/db";
import { and, eq, sql } from "drizzle-orm";
import { buildProviders } from "../providers/registry";
import { slugifyTitle } from "../lib/slug";
import { subtitleFormatFromUrl } from "../providers/sapimu/core/media";
import type { ProviderDramaSummary, ProviderEpisodeSummary } from "@dramaplay/shared";

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
}

export async function fetchAllProviderSummaries(
  adapter: ReturnType<typeof buildProviders>[string],
  searchKeywords: string[] = [],
): Promise<ProviderDramaSummary[]> {
  const batches = await Promise.all([
    adapter.fetchForYou().then((r) => r.items),
    adapter.fetchTrending(),
    adapter.fetchLatest(),
    adapter.fetchVip(),
    ...searchKeywords.map((q) => adapter.search(q)),
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
  options: { fast?: boolean; searchKeywords?: string[]; maxItems?: number; consumerUrl?: string } = {},
): Promise<SyncResult> {
  const db = createDb(dbUrl);
  const adapters = buildProviders(providerBaseUrl, providerToken);
  const adapter = adapters[providerCode];
  if (!adapter) throw new Error(`unknown provider ${providerCode}`);

  const startedAt = new Date();
  const result: SyncResult = { dramaNew: 0, dramaUpdated: 0, episodeNew: 0, errorCount: 0 };

  const [providerRow] = await db.select().from(providers).where(eq(providers.code, providerCode));
  if (!providerRow) throw new Error("provider not registered");

  try {
    const items: ProviderDramaSummary[] = await fetchAllProviderSummaries(adapter, options.searchKeywords);
    const selectedItems = options.maxItems ? items.slice(0, options.maxItems) : items;
    if (options.consumerUrl) {
      const posters = await warmPosterUrls(options.consumerUrl, selectedItems);
      console.log(` posters: ${posters.warmed} cached, ${posters.failed} failed`);
      result.errorCount += posters.failed;
    }
    for (const item of selectedItems) {
      try {
        const slug = providerSlug(providerCode, item.title);
        const existing = await db.select().from(dramas).where(eq(dramas.slug, slug)).limit(1);
        let dramaId: string;

        let existingEpisodeCount = 0;
        if (existing.length > 0) {
          existingEpisodeCount = existing[0].episodeCount;
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

        // ponytail: daily fast sync only updates catalog/new dramas.
        // Full episode refresh is slow; run without SYNC_FAST when needed.
        if (options.fast && existingEpisodeCount > 0) continue;

        const eps: ProviderEpisodeSummary[] = await adapter.fetchEpisodes(item.providerDramaId);
        if (eps.length) {
          // ponytail: bulk per-drama — 1 select (existing numbers) + 1 insert.
          // Avoids N sequential round-trips AND needs no unique constraint.
          const existing = await db
            .select({ n: episodes.episodeNumber })
            .from(episodes)
            .where(eq(episodes.dramaId, dramaId));
          const have = new Set(existing.map((e) => e.n));
          const toInsert = eps.filter((e) => !have.has(e.episodeNumber));
          let inserted: { id: string; episodeNumber: number }[] = [];
          if (toInsert.length) {
            inserted = await db
              .insert(episodes)
              .values(
                toInsert.map((ep) => ({
                  dramaId,
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
                    `${item.providerDramaId}:${row.episodeNumber}`,
                  isPrimary: true,
                })),
              )
              .onConflictDoNothing();
          }
          // Keep dramas.episodeCount in sync with the episodes table so catalog
          // cards/shelves show real counts without a per-row subquery.
          await db
            .update(dramas)
            .set({ episodeCount: have.size + toInsert.length, updatedAt: new Date() })
            .where(eq(dramas.id, dramaId));

          // Re-apply free/VIP threshold. 10% of episodes are free, minimum 2.
          const total = have.size + toInsert.length;
          const threshold = Math.max(2, Math.ceil(total * 0.1));
          await db
            .update(episodes)
            .set({ accessType: "free" })
            .where(
              and(eq(episodes.dramaId, dramaId), sql`${episodes.episodeNumber} <= ${threshold}`),
            );
          await db
            .update(episodes)
            .set({ accessType: "vip" })
            .where(
              and(eq(episodes.dramaId, dramaId), sql`${episodes.episodeNumber} > ${threshold}`),
            );

          // ponytail: resolve subtitles for newly-inserted FREE episodes only.
          // VIP episodes get subtitles via watch write-through.
          if (toInsert.length) {
            const freeNew = inserted.filter((r: { id: string; episodeNumber: number }) => r.episodeNumber <= threshold);
            for (const row of freeNew) {
              try {
                const epProvider = eps.find((e) => e.episodeNumber === row.episodeNumber);
                if (!epProvider) continue;
                const stream = await adapter.resolveStream(epProvider.providerEpisodeId);
                if (!stream?.subtitleUrl) continue;
                const fmt = subtitleFormatFromUrl(stream.subtitleUrl);
                await db
                  .insert(subtitles)
                  .values({
                    episodeId: row.id,
                    language: stream.subtitleLanguage ?? "id",
                    source: "provider",
                    format: fmt,
                    url: stream.subtitleUrl,
                    isDefault: true,
                  })
                  .onConflictDoNothing();
              } catch (e) {
                console.error(`[sync] subtitle ${providerCode}/${item.providerDramaId}:${row.episodeNumber}: ${e}`);
              }
            }
          }
        }
      } catch (e) {
        console.error(`[sync] ${providerCode}/${item.providerDramaId}: ${e}`);
        result.errorCount++;
      }
    }

    await db
      .update(providers)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: result.errorCount === 0 ? "success" : "partial",
      })
      .where(eq(providers.id, providerRow.id));

    await db.insert(syncLogs).values({
      providerId: providerRow.id,
      jobType: "latest",
      triggerType: "cron",
      status: result.errorCount === 0 ? "success" : "partial",
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
