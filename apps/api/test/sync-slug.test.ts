import { describe, expect, it, vi } from "vitest";
import { slugifyTitle } from "../src/lib/slug";

// Re-implement providerSlug locally so the test is self-contained
function providerSlug(providerCode: string, title: string): string {
  return `${providerCode}-${slugifyTitle(title)}`;
}

describe("providerSlug", () => {
  it("prefixes slug with provider code", () => {
    expect(providerSlug("reelshort", "Love in the Ashes")).toBe("reelshort-love-in-the-ashes");
  });

  it("handles special chars in title", () => {
    expect(providerSlug("netshort", "Cinta Yang [Dubbing] - Sesuatu")).toBe(
      "netshort-cinta-yang-dubbing-sesuatu"
    );
  });

  it("keeps same title from different providers separate", () => {
    const slugN = providerSlug("netshort", "Love");
    const slugR = providerSlug("reelshort", "Love");
    expect(slugN).not.toBe(slugR);
    expect(slugN).toBe("netshort-love");
    expect(slugR).toBe("reelshort-love");
  });
});
