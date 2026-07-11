import type { ProviderAdapter } from "@dramaplay/shared";
import { JsonListProviderAdapter } from "./json-list";
import { buildV2Providers } from "./sapimu/providers";

/** Build provider adapters. Sapimu hosts use the current (v2) engine only. */
export function buildProviders(
  baseUrl: string,
  token?: string,
): Record<string, ProviderAdapter> {
  if (baseUrl.includes("sapimu.au") && token) {
    return buildV2Providers(baseUrl, token);
  }

  // Non-Sapimu / local fixtures (JSON list endpoints).
  return {
    dramabox: new JsonListProviderAdapter("dramabox", baseUrl, "dramabox"),
    reelshort: new JsonListProviderAdapter("reelshort", baseUrl, "reelshort"),
    shortmax: new JsonListProviderAdapter("shortmax", baseUrl, "shortmax"),
  };
}
