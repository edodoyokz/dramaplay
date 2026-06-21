import type { ProviderAdapter } from "@dramaplay/shared";
import { DramaBoxAdapter } from "./dramabox";
import { ReelShortAdapter } from "./reelshort";
import { ShortMaxAdapter } from "./shortmax";

export function buildProviders(baseUrl: string): Record<string, ProviderAdapter> {
  return {
    dramabox: new DramaBoxAdapter(baseUrl),
    reelshort: new ReelShortAdapter(baseUrl),
    shortmax: new ShortMaxAdapter(baseUrl),
  };
}
