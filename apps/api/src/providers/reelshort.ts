import { JsonListProviderAdapter } from "./json-list";

export class ReelShortAdapter extends JsonListProviderAdapter {
  constructor(baseUrl: string) {
    super("reelshort", baseUrl, "reelshort");
  }
}
