/**
 * Live smoke test for Sapimu batch-1 providers.
 *
 * Quality gate per provider (from design doc):
 *   1. title present
 *   2. poster present
 *   3. episode count > 0
 *   4. episode list present
 *   5. episode 1 playable (resolveStream returns a URL)
 *
 * Usage:
 *   SAPIMU_TOKEN=xxx npx tsx apps/api/scripts/smoke-sapimu-providers.ts
 *
 * Pass --enable to auto-enable providers that pass all gates.
 */
import { buildProviders } from "../src/providers/registry";

const BASE_URL = process.env.SAPIMU_BASE_URL ?? "https://captain.sapimu.au";
const TOKEN = process.env.SAPIMU_TOKEN ?? "";
const AUTO_ENABLE = process.argv.includes("--enable");

interface GateResult {
  provider: string;
  passed: boolean;
  details: string;
  sample?: { title: string; poster: string; episodeCount: number; streamUrl?: string };
}

async function smokeProvider(code: string, adapter: any): Promise<GateResult> {
  try {
    const { items } = await adapter.fetchForYou();
    if (!items || items.length === 0) {
      return { provider: code, passed: false, details: "fetchForYou returned 0 items" };
    }
    const first = items[0];
    if (!first.title) return { provider: code, passed: false, details: "title missing" };
    if (!first.posterUrl) return { provider: code, passed: false, details: "poster missing" };

    const detail = await adapter.fetchDetail(first.providerDramaId);
    if (!detail) return { provider: code, passed: false, details: "fetchDetail returned null" };

    const eps = await adapter.fetchEpisodes(first.providerDramaId);
    if (!eps || eps.length === 0) {
      return { provider: code, passed: false, details: "episode count = 0" };
    }

    const stream = await adapter.resolveStream(eps[0].providerEpisodeId);
    if (!stream || !stream.streamUrl) {
      return { provider: code, passed: false, details: "episode 1 not playable (no stream URL)" };
    }

    return {
      provider: code,
      passed: true,
      details: "all gates passed",
      sample: {
        title: first.title,
        poster: first.posterUrl,
        episodeCount: eps.length,
        streamUrl: stream.streamUrl,
      },
    };
  } catch (err: any) {
    return { provider: code, passed: false, details: `error: ${err?.message ?? err}` };
  }
}

async function main() {
  if (!TOKEN) {
    console.error("SAPIMU_TOKEN env var required");
    process.exit(1);
  }

  const providers = buildProviders(BASE_URL, TOKEN);
  const codes = Object.keys(providers).sort();

  console.log(`\n=== Sapimu Provider Smoke Test ===`);
  console.log(`Base: ${BASE_URL}\n`);

  const results: GateResult[] = [];
  for (const code of codes) {
    const adapter = providers[code];
    if (!adapter) {
      results.push({ provider: code, passed: false, details: "adapter not registered" });
      continue;
    }
    process.stdout.write(`  ${code}...`);
    const result = await smokeProvider(code, adapter);
    const icon = result.passed ? "✅" : "❌";
    console.log(` ${icon} ${result.details}`);
    if (result.sample) {
      console.log(`     sample: "${result.sample.title}" (${result.sample.episodeCount} eps)`);
    }
    results.push(result);
  }

  const passed = results.filter((r) => r.passed).map((r) => r.provider);
  const failed = results.filter((r) => !r.passed).map((r) => r.provider);

  console.log(`\n=== Summary ===`);
  console.log(`Passed (${passed.length}): ${passed.join(", ") || "none"}`);
  console.log(`Failed (${failed.length}): ${failed.join(", ") || "none"}`);

  if (AUTO_ENABLE && passed.length > 0) {
    console.log(`\n--enable flag set. Run this SQL to enable passing providers:`);
    console.log(
      `UPDATE providers SET "isEnabled" = true WHERE code IN (${passed
        .map((c) => `'${c}'`)
        .join(", ")});`
    );
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
