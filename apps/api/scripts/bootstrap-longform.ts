import { syncProvider } from "../src/sync/sync";
import {
  parseBootstrapArgs,
  shouldContinueBootstrap,
  type BootstrapProvider,
} from "../src/sync/bootstrap";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function bootstrapProvider(
  code: BootstrapProvider,
  dbUrl: string,
  baseUrl: string,
  token: string | undefined,
  maxPasses: number,
  delayMs: number,
) {
  let pass = 1;
  let totalEpisodes = 0;

  while (true) {
    const result = await syncProvider(dbUrl, code, baseUrl, token, {
      fast: true,
      maxItems: 250,
      maxNewEpisodeDramas: 20,
      maxEpisodesPerDrama: 500,
      timeBudgetMs: 300_000,
      env: process.env as Record<string, string | undefined>,
    });
    totalEpisodes += result.episodeNew;
    console.log(
      `[bootstrap] ${code} pass=${pass}/${maxPasses} dramas=+${result.dramaNew}/${result.dramaUpdated} episodes=+${result.episodeNew} totalEpisodes=+${totalEpisodes} errors=${result.errorCount}`,
    );

    if (!shouldContinueBootstrap({ episodeNew: result.episodeNew, pass, maxPasses })) {
      if (result.episodeNew === 0) {
        console.log(
          `[bootstrap] ${code}: no episode progress; remaining empty/incomplete titles require upstream data`,
        );
      }
      return;
    }
    pass++;
    if (delayMs) await sleep(delayMs);
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const baseUrl = process.env.PROVIDER_BASE_URL;
  if (!dbUrl || !baseUrl) {
    throw new Error("DATABASE_URL and PROVIDER_BASE_URL are required");
  }
  const { providers, maxPasses, delayMs } = parseBootstrapArgs(process.argv.slice(2));
  for (const code of providers) {
    await bootstrapProvider(
      code,
      dbUrl,
      baseUrl,
      process.env.PROVIDER_API_TOKEN,
      maxPasses,
      delayMs,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
