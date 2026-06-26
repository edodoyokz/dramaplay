import type { SapimuProviderDef } from "./types";

const REQUIRED_ENDPOINTS = ["trending", "latest", "foryou", "search", "detail", "play"] as const;
const REQUIRED_FIELDS = ["id", "title", "poster"] as const;

export function defineSapimuProvider(def: SapimuProviderDef): SapimuProviderDef {
  if (!def.code) throw new Error("provider def: code required");
  for (const e of REQUIRED_ENDPOINTS) {
    if (!def.endpoints?.[e]) throw new Error(`provider ${def.code}: endpoint ${e} required`);
  }
  for (const f of REQUIRED_FIELDS) {
    if (!def.fields?.[f]?.length) throw new Error(`provider ${def.code}: field ${f} required`);
  }
  if (!def.subtitlePolicy) throw new Error(`provider ${def.code}: subtitlePolicy required`);
  return def;
}
