/**
 * Smoke test: v2 provider adapters produce the same output shape as legacy.
 * Run: pnpm tsx scripts/smoke-v2-vs-legacy.ts
 * Requires: .env.deploy (PROVIDER_BASE_URL, PROVIDER_API_TOKEN)
 */
import { readFileSync } from "node:fs";
import { buildProviders } from "../src/providers/registry";

// Load env from .env.deploy
try {
  const envFile = readFileSync("../../.env.deploy", "utf-8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch { /* fallback to existing env */ }

const base = process.env.PROVIDER_BASE_URL!;
const token = process.env.PROVIDER_API_TOKEN!;
if (!base || !token) {
  console.error("Missing PROVIDER_BASE_URL / PROVIDER_API_TOKEN");
  process.exit(1);
}

const PROVIDERS = ["dramawave", "dramaboxbaru", "dramanova", "netshort", "pinedrama", "reelshort", "melolo", "shortmax", "goodshort"];

async function smoke() {
  const legacy = buildProviders(base, token, { engine: "legacy" });
  const v2 = buildProviders(base, token, { engine: "v2" });

  for (const code of PROVIDERS) {
    const l = legacy[code];
    const v = v2[code];
    if (!l || !v) { console.log(`⚠️  ${code}: missing adapter (legacy=${!!l}, v2=${!!v})`); continue; }

    try {
      const [lTrending, vTrending] = await Promise.all([
        l.fetchTrending().catch(() => []),
        v.fetchTrending().catch(() => []),
      ]);
      const lCount = Array.isArray(lTrending) ? lTrending.length : 0;
      const vCount = Array.isArray(vTrending) ? vTrending.length : 0;
      const match = lCount > 0 && vCount > 0;
      console.log(`${match ? "✅" : "⚠️"}  ${code}: legacy=${lCount} v2=${vCount} trending items`);

      // Check first item shape
      const vFirst = Array.isArray(vTrending) && vTrending[0];
      if (vFirst) {
        const has = (k: string) => k in vFirst ? "✓" : "✗";
        console.log(`   fields: id=${has("providerDramaId")} title=${has("title")} poster=${has("posterUrl")} backdrop=${has("backdropUrl")}`);
      }
    } catch (e) {
      console.log(`❌  ${code}: ${e}`);
    }
  }
}

smoke().catch(console.error);
