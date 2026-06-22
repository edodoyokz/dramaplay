import type { ProviderAdapter } from "@dramaplay/shared";
import { JsonListProviderAdapter } from "./json-list";

export function buildProviders(baseUrl: string): Record<string, ProviderAdapter> {
  return {
    dramabox: new JsonListProviderAdapter("dramabox", baseUrl, "dramabox"),
    reelshort: new JsonListProviderAdapter("reelshort", baseUrl, "reelshort"),
    shortmax: new JsonListProviderAdapter("shortmax", baseUrl, "shortmax"),
  };
}
