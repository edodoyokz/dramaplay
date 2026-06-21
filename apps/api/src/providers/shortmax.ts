import { JsonListProviderAdapter } from "./json-list";

export class ShortMaxAdapter extends JsonListProviderAdapter {
  constructor(baseUrl: string) {
    super("shortmax", baseUrl, "shortmax");
  }
}
