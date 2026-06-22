import type { ProviderAdapter } from "@dramaplay/shared";
import { JsonListProviderAdapter } from "./json-list";
import { SapimuProviderAdapter } from "./sapimu";

export function buildProviders(baseUrl: string, token?: string): Record<string, ProviderAdapter> {
  if (baseUrl.includes("sapimu.au") && token) {
    const sapimu = new SapimuProviderAdapter("shortmax", baseUrl, token);
    return { shortmax: sapimu };
  }

  return {
    dramabox: new JsonListProviderAdapter("dramabox", baseUrl, "dramabox"),
    reelshort: new JsonListProviderAdapter("reelshort", baseUrl, "reelshort"),
    shortmax: new JsonListProviderAdapter("shortmax", baseUrl, "shortmax"),
  };
}
