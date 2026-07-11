import { describe, expect, it } from "vitest";
import { parseSyncProviderArgs } from "../scripts/sync-providers";

describe("parseSyncProviderArgs", () => {
  it("adds Indonesian seed keywords with --search-seed", () => {
    expect(parseSyncProviderArgs(["reelshort", "--search-seed"])).toEqual({
      codes: ["reelshort"],
      searchKeywords: ["cinta", "nikah", "istri", "suami", "ceo", "miliarder", "sistem", "balas", "dendam", "hamil", "kontrak"],
      maxItems: undefined,
    });
  });

  it("keeps explicit --search keywords", () => {
    expect(parseSyncProviderArgs(["reelshort", "--search", "sistem"])).toEqual({
      codes: ["reelshort"],
      searchKeywords: ["sistem"],
      maxItems: undefined,
    });
  });

  it("supports --max to keep large syncs bounded", () => {
    expect(parseSyncProviderArgs(["reelshort", "--search-seed", "--max", "40"])).toMatchObject({
      codes: ["reelshort"],
      maxItems: 40,
    });
  });
});
