/**
 * Manual sync runner for Sapimu providers (one-off DB population).
 * The cron trigger is disabled; run this to seed dramas/episodes into the DB.
 * Usage: node --import tsx scripts/sync-providers.ts
 */
import { syncProvider } from "../src/sync/sync";
import { createDb, providers } from "@dramaplay/db";
import { eq } from "drizzle-orm";
import { pathToFileURL } from "node:url";

export const SEARCH_SEED_KEYWORDS = [
  "cinta",
  "nikah",
  "istri",
  "suami",
  "ceo",
  "miliarder",
  "sistem",
  "balas",
  "dendam",
  "hamil",
  "kontrak",
];

export function parseSyncProviderArgs(args: string[]) {
  const seed = args.includes("--search-seed");
  const maxIndex = args.indexOf("--max");
  const maxItems = maxIndex >= 0 ? Number(args[maxIndex + 1]) || undefined : undefined;
  const clean = args.filter(
    (a, i) => a !== "--search-seed" && (maxIndex < 0 || (i !== maxIndex && i !== maxIndex + 1)),
  );
  const keywordIndex = clean.indexOf("--search");
  const codes = keywordIndex >= 0 ? clean.slice(0, keywordIndex) : clean;
  const explicit = keywordIndex >= 0 ? clean.slice(keywordIndex + 1) : [];
  return {
    codes,
    searchKeywords: [...(seed ? SEARCH_SEED_KEYWORDS : []), ...explicit],
    maxItems,
  };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL!;
  const baseUrl = process.env.PROVIDER_BASE_URL!;
  const token = process.env.PROVIDER_API_TOKEN;
  const { codes, searchKeywords, maxItems } = parseSyncProviderArgs(process.argv.slice(2));

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
      const r = await syncProvider(dbUrl, code, baseUrl, token, {
        fast: process.env.SYNC_FAST !== "0",
        searchKeywords,
        maxItems,
        consumerUrl: code === "pinedrama" ? process.env.CONSUMER_URL : undefined,
        env: process.env as Record<string, string | undefined>,
      });
      console.log(
        ` done: +${r.dramaNew} dramas (${r.dramaUpdated} upd), +${r.episodeNew} eps, ${r.errorCount} errs`
      );
    } catch (e: any) {
      console.log(` FAILED: ${e.message}`);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
