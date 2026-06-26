import type { ProviderAdapter } from "@dramaplay/shared";
import { JsonListProviderAdapter } from "./json-list";
import { SapimuProviderAdapter } from "./sapimu";
import { GoodShortAdapter } from "./sapimu/goodshort";
import { buildBatch1Adapters } from "./sapimu/batch1";
import { buildV2Providers } from "./sapimu/providers";

export interface BuildProvidersOpts {
  engine?: "v2" | "legacy";
}

export function buildProviders(
  baseUrl: string,
  token?: string,
  opts?: BuildProvidersOpts,
): Record<string, ProviderAdapter> {
  if (baseUrl.includes("sapimu.au") && token) {
    if (opts?.engine === "v2") {
      return buildV2Providers(baseUrl, token);
    }

    // Legacy path (default)
    const shortmax = new SapimuProviderAdapter("shortmax", baseUrl, token);
    const goodshort = new GoodShortAdapter("goodshort", baseUrl, token);
    const batch1 = buildBatch1Adapters(baseUrl, token);
    return { shortmax, goodshort, ...batch1 };
  }

  return {
    dramabox: new JsonListProviderAdapter("dramabox", baseUrl, "dramabox"),
    reelshort: new JsonListProviderAdapter("reelshort", baseUrl, "reelshort"),
    shortmax: new JsonListProviderAdapter("shortmax", baseUrl, "shortmax"),
  };
}
