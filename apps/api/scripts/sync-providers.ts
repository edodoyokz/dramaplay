/**
 * Manual sync runner for Sapimu providers (one-off DB population).
 * The cron trigger is disabled; run this to seed dramas/episodes into the DB.
 * Usage: node --import tsx scripts/sync-providers.ts
 */
import { syncProvider } from "../src/sync/sync";
import { createDb, providers } from "@dramaplay/db";
import { eq } from "drizzle-orm";

async function main() {
  const dbUrl = process.env.DATABASE_URL!;
  const baseUrl = process.env.PROVIDER_BASE_URL!;
  const token = process.env.PROVIDER_API_TOKEN;
  const codes = process.argv.slice(2);

  const all = codes.length === 0;
  if (all) {
    const db = createDb(dbUrl);
    const rows = await db
      .select({ code: providers.code })
      .from(providers)
      .where(eq(providers.isEnabled, true));
    codes.push(...rows.map((r) => r.code));
    console.log(`Syncing ${codes.length} providers: ${codes.join(", ")}`);
  }

  for (const code of codes) {
    process.stdout.write(`  syncing ${code}...`);
    try {
      const r = await syncProvider(dbUrl, code, baseUrl, token);
      console.log(
        ` done: +${r.dramaNew} dramas (${r.dramaUpdated} upd), +${r.episodeNew} eps, ${r.errorCount} errs`
      );
    } catch (e: any) {
      console.log(` FAILED: ${e.message}`);
    }
  }
}

main();
