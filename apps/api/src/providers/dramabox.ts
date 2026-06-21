import { JsonListProviderAdapter } from "./json-list";

export class DramaBoxAdapter extends JsonListProviderAdapter {
  constructor(baseUrl: string) {
    super("dramabox", baseUrl, "dramabox");
  }
}
