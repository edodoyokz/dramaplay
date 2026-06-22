import type { ProviderAdapter } from "@dramaplay/shared";
import { JsonListProviderAdapter } from "./json-list";
import { SapimuProviderAdapter } from "./sapimu";
import { buildBatch1Adapters } from "./sapimu/batch1";

export function buildProviders(baseUrl: string, token?: string): Record<string, ProviderAdapter> {
  if (baseUrl.includes("sapimu.au") && token) {
    // ShortMax uses the original SapimuProviderAdapter (existing, tested)
    const shortmax = new SapimuProviderAdapter("shortmax", baseUrl, token);
    // All batch-1 providers (incl. dramawave) via config-driven factory
    const batch1 = buildBatch1Adapters(baseUrl, token);
    return {
      shortmax,
      ...batch1,
    };
  }

  return {
    dramabox: new JsonListProviderAdapter("dramabox", baseUrl, "dramabox"),
    reelshort: new JsonListProviderAdapter("reelshort", baseUrl, "reelshort"),
    shortmax: new JsonListProviderAdapter("shortmax", baseUrl, "shortmax"),
  };
}
