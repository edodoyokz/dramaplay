import { describe, expect, it } from "vitest";
import { buildV2Providers } from "../src/providers/sapimu/providers";

describe("buildV2Providers", () => {
  it("returns all 9 provider adapters", () => {
    const result = buildV2Providers("https://captain.sapimu.au", "tok");
    const codes = Object.keys(result).sort();
    expect(codes).toEqual([
      "dramaboxbaru",
      "dramanova",
      "dramawave",
      "goodshort",
      "melolo",
      "netshort",
      "pinedrama",
      "reelshort",
      "shortmax",
    ]);
  });

  it("each adapter has required methods", () => {
    const result = buildV2Providers("https://captain.sapimu.au", "tok");
    for (const [code, adapter] of Object.entries(result)) {
      expect(typeof adapter.fetchTrending, `${code}.fetchTrending`).toBe("function");
      expect(typeof adapter.resolveStream, `${code}.resolveStream`).toBe("function");
      expect(typeof adapter.fetchForYou, `${code}.fetchForYou`).toBe("function");
    }
  });
});
