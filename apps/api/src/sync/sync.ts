import { createDb, providers, syncLogs, dramas, dramaProviders, episodes, episodeProviders } from "@dramaplay/db";
import { eq } from "drizzle-orm";
import { buildProviders } from "../providers/registry";
import { slugifyTitle } from "../lib/slug";
import type { ProviderDramaSummary, ProviderEpisodeSummary } from "@dramaplay/shared";

interface SyncResult {
  dramaNew: number;
  dramaUpdated: number;
  episodeNew: number;
  errorCount: number;
}

export async function syncProvider(
  dbUrl: string,
  providerCode: string,
  providerBaseUrl: string
): Promise<SyncResult> {
  const db = createDb(dbUrl);
  const adapters = buildProviders(providerBaseUrl);
  const adapter = adapters[providerCode];
  if (!adapter) throw new Error(`unknown provider ${providerCode}`);

  const startedAt = new Date();
  const result: SyncResult = { dramaNew: 0, dramaUpdated: 0, episodeNew: 0, errorCount: 0 };

  const [providerRow] = await db.select().from(providers).where(eq(providers.code, providerCode));
  if (!providerRow) throw new Error("provider not registered");

  try {
    const items: ProviderDramaSummary[] = await adapter.fetchLatest();
    for (const item of items) {
      try {
        const slug = slugifyTitle(item.title);
        const existing = await db.select().from(dramas).where(eq(dramas.slug, slug)).limit(1);
        let dramaId: string;

        if (existing.length > 0) {
          const [updated] = await db
            .update(dramas)
            .set({ title: item.title, posterUrl: item.posterUrl, updatedAt: new Date() })
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

        await db
          .insert(dramaProviders)
          .values({
            dramaId,
            providerId: providerRow.id,
            providerDramaId: item.providerDramaId,
            isPrimary: true,
          })
          .onConflictDoNothing();

        const eps: ProviderEpisodeSummary[] = await adapter.fetchEpisodes(item.providerDramaId);
        for (const ep of eps) {
          const existingEp = await db
            .select()
            .from(episodes)
            .where(eq(episodes.dramaId, dramaId))
            .limit(1);
          if (existingEp.length === 0) {
            const [created] = await db
              .insert(episodes)
              .values({
                dramaId,
                episodeNumber: ep.episodeNumber,
                title: ep.title,
                thumbnailUrl: ep.thumbnailUrl,
                durationSeconds: ep.durationSeconds,
              })
              .returning();
            await db
              .insert(episodeProviders)
              .values({
                episodeId: created.id,
                providerId: providerRow.id,
                providerEpisodeId: ep.providerEpisodeId,
                isPrimary: true,
              })
              .onConflictDoNothing();
            result.episodeNew++;
          }
        }
      } catch {
        result.errorCount++;
      }
    }

    await db
      .update(providers)
      .set({ lastSyncAt: new Date(), lastSyncStatus: result.errorCount === 0 ? "success" : "partial" })
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
