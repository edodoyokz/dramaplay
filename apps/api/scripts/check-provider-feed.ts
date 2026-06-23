import { buildProviders } from "../src/providers/registry";
import { fetchAllProviderSummaries } from "../src/sync/sync";
const code = process.argv[2] || "dramaboxbaru";
const a = buildProviders(process.env.PROVIDER_BASE_URL!, process.env.PROVIDER_API_TOKEN)[code];
const rows = await fetchAllProviderSummaries(a);
console.log(rows.length, rows.slice(0, 10).map((x) => x.title));
process.exit(0);
