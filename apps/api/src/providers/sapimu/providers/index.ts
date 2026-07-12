/**
 * Provider V2 registry: builds all provider adapters from modular definitions.
 * ponytail: 8 use SapimuPresetAdapter from defineSapimuProvider; goodshort keeps its custom adapter.
 */
import type { ProviderAdapter } from "@dramaplay/shared";
import { SapimuPresetAdapter } from "../core/adapter";
import { GoodShortAdapter } from "../goodshort";
import { WetvAdapter } from "../wetv";
import { MovieBoxAdapter } from "../moviebox";

import { dramawave } from "./dramawave";
import { dramaboxbaru } from "./dramaboxbaru";
import { dramanova } from "./dramanova";
import { netshort } from "./netshort";
import { pinedrama } from "./pinedrama";
import { reelshort } from "./reelshort";
import { melolo } from "./melolo";
import { shortmax } from "./shortmax";
import { freereels } from "./freereels";
import { idrama } from "./idrama";

export const ALL_PROVIDER_DEFS = [
  dramawave,
  dramaboxbaru,
  dramanova,
  netshort,
  pinedrama,
  reelshort,
  melolo,
  shortmax,
  freereels,
  idrama,
] as const;

export function buildV2Providers(baseUrl: string, token: string): Record<string, ProviderAdapter> {
  const result: Record<string, ProviderAdapter> = {};
  for (const def of ALL_PROVIDER_DEFS) {
    result[def.code] = new SapimuPresetAdapter(def, baseUrl, token);
  }
  // goodshort / wetv: custom adapters (not SapimuPresetAdapter)
  result.goodshort = new GoodShortAdapter("goodshort", baseUrl, token);
  result.wetv = new WetvAdapter(baseUrl, token);
  result.moviebox = new MovieBoxAdapter(baseUrl, token);
  return result;
}

export {
  dramawave,
  dramaboxbaru,
  dramanova,
  netshort,
  pinedrama,
  reelshort,
  melolo,
  shortmax,
  freereels,
  idrama,
};
