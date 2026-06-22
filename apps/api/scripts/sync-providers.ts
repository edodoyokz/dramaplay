/**
 * Manual sync runner for Sapimu providers (one-off DB population).
 * The cron trigger is disabled; run this to seed dramas/episodes into the DB.
 * Usage: node --import tsx scripts/sync-providers.ts
 */
import { syncProvider } from "../src/sync/sync";

async function main() {
  const dbUrl = process.env.DATABASE_URL!;
  const baseUrl = process.env.PROVIDER_BASE_URL!;
  const token = process.env.PROVIDER_API_TOKEN;
  const codes = process.argv.slice(2);

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
