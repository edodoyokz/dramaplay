import { buildProviders } from "../src/providers/registry";
import { providerPreflight } from "../src/providers/preflight";

const code = process.argv[2];
if (!code) {
  console.error("Usage: tsx scripts/preflight-provider.ts <provider>");
  process.exit(2);
}

const baseUrl = process.env.PROVIDER_BASE_URL;
const token = process.env.PROVIDER_API_TOKEN ?? process.env.SAPIMU_TOKEN;
if (!baseUrl || !token) {
  console.error("PROVIDER_BASE_URL and PROVIDER_API_TOKEN/SAPIMU_TOKEN required");
  process.exit(2);
}

const adapter = buildProviders(baseUrl, token)[code];
if (!adapter) {
  console.error(`unknown provider: ${code}`);
  process.exit(2);
}

const result = await providerPreflight(code, adapter);
if (!result.ok) {
  console.error(`❌ ${code}: ${result.error}${result.sampleTitle ? ` (${result.sampleTitle})` : ""}`);
  process.exit(1);
}

console.log(`✅ ${code}: ${result.sampleTitle} · ${result.episodeCount} eps · ${result.streamType}`);
