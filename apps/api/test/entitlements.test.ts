import { describe, expect, it } from "vitest";
import { nextExpiry } from "../src/lib/entitlements";

describe("nextExpiry", () => {
  const day = 86_400_000;

  it("starts from now when no active sub", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(nextExpiry(now, 7, null).toISOString()).toBe("2026-06-08T00:00:00.000Z");
  });

  it("starts from now when existing sub already expired", () => {
    const now = new Date("2026-06-10T00:00:00Z");
    const expired = new Date("2026-06-01T00:00:00Z");
    expect(nextExpiry(now, 7, expired).toISOString()).toBe("2026-06-17T00:00:00.000Z");
  });

  it("extends from remaining VIP time", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const remaining = new Date("2026-06-05T00:00:00Z"); // 4 days left
    // 4 + 7 = 11 days from now → June 12
    expect(nextExpiry(now, 7, remaining).getTime()).toBe(remaining.getTime() + 7 * day);
    expect(nextExpiry(now, 7, remaining).toISOString()).toBe("2026-06-12T00:00:00.000Z");
  });
});
