import { createDb, dramas, dramaProviders, providers } from "@dramaplay/db";
import { and, eq } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { findDetailRow, pickString, POSTER_FIELDS } from "../src/providers/sapimu/base";
import { warmPosterUrls } from "../src/sync/sync";

export async function backfillPinedramaPosters(
  dbUrl: string,
  providerBaseUrl: string,
  providerToken: string | undefined,
  consumerUrl: string,
) {
  const db = createDb(dbUrl);
  const [provider] = await db.select().from(providers).where(eq(providers.code, "pinedrama"));
  if (!provider) throw new Error("pinedrama provider not registered");

  const rows = await db
    .select({ dramaId: dramas.id, providerDramaId: dramaProviders.providerDramaId, posterUrl: dramas.posterUrl })
    .from(dramaProviders)
    .innerJoin(dramas, eq(dramas.id, dramaProviders.dramaId))
    .where(and(eq(dramaProviders.providerId, provider.id), eq(dramaProviders.isPrimary, true)));

  let updated = 0;
  let cached = 0;
  let failed = 0;
  const headers = { Authorization: `Bearer ${providerToken ?? ""}`, "User-Agent": "Mozilla/5.0" };

  // Cover-only: bounded parallel detail fetches, no episode/subtitle calls.
  for (let offset = 0; offset < rows.length; offset += 8) {
    await Promise.all(rows.slice(offset, offset + 8).map(async (row) => {
      try {
        const path = `/pinedrama/api/drama/detail?collection_id=${encodeURIComponent(row.providerDramaId)}&language=id&region=ID`;
        const response = await fetch(`${providerBaseUrl.replace(/\/$/, "")}${path}`, {
          headers,
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`detail ${response.status}`);
        const detail = findDetailRow(await response.json());
        const posterUrl = (detail && pickString(detail, POSTER_FIELDS)) ?? row.posterUrl;
        if (!posterUrl) throw new Error("poster missing");
        const warm = await warmPosterUrls(consumerUrl, [{ posterUrl }]);
        if (!warm.warmed) throw new Error("poster cache failed");
        await db.update(dramas).set({ posterUrl, updatedAt: new Date() }).where(eq(dramas.id, row.dramaId));
        updated++;
        cached++;
      } catch (error) {
        failed++;
        console.error(`[poster-backfill] ${row.providerDramaId}: ${error}`);
      }
    }));
    console.log(`[poster-backfill] ${Math.min(offset + 8, rows.length)}/${rows.length}`);
  }
  return { total: rows.length, updated, cached, failed };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await backfillPinedramaPosters(
    process.env.DATABASE_URL!,
    process.env.PROVIDER_BASE_URL!,
    process.env.PROVIDER_API_TOKEN,
    process.env.CONSUMER_URL ?? "https://dramaplay.my.id",
  );
  console.log(result);
  if (result.failed) process.exitCode = 1;
}
