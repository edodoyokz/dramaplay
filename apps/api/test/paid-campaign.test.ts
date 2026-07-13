import { describe, expect, it } from "vitest";
import {
  campaignAvailability,
  campaignExpiry,
  normalizeAttribution,
  normalizeCampaignCode,
  publicCampaignStatus,
  parseCampaignCheckoutBody,
  campaignCheckoutError,
} from "../src/lib/paid-campaign";

describe("paid campaign rules", () => {
  it("parses and bounds nested checkout attribution", () => {
    // Given the consumer checkout contract with nested attribution
    const body = {
      code: "FB15K",
      attribution: { utmSource: ` ${"x".repeat(140)} `, utmContent: " group-a " },
    };

    // When the request boundary parses it
    const parsed = parseCampaignCheckoutBody(body);

    // Then nested values are preserved, trimmed, and bounded
    expect(parsed).toEqual({
      code: "FB15K",
      attribution: { utmSource: "x".repeat(100), utmContent: "group-a" },
    });
  });

  it("maps ineligible checkout to the consumer error vocabulary", () => {
    // Given an ineligible campaign checkout result
    // When the route error is selected
    const error = campaignCheckoutError("ineligible");

    // Then the consumer-recognized code is returned
    expect(error).toEqual({ error: "not_eligible", status: 409 });
  });

  it("normalizes a public campaign code", () => {
    // Given mixed-case code with whitespace
    const code = "  fb15k ";

    // When it is normalized
    const normalized = normalizeCampaignCode(code);

    // Then the lookup code is canonical
    expect(normalized).toBe("FB15K");
  });

  it("reserves capacity for exactly 24 hours", () => {
    // Given a checkout time and reservation duration
    const now = new Date("2026-07-13T00:00:00.000Z");

    // When expiry is calculated
    const expiresAt = campaignExpiry(now, 24);

    // Then expiry is 24 hours later
    expect(expiresAt.toISOString()).toBe("2026-07-14T00:00:00.000Z");
  });

  it("closes capacity when paid and active reservations reach the cap", () => {
    // Given all 500 slots are paid or actively reserved
    const occupied = { paid: 490, reserved: 10, capacity: 500 };

    // When availability is calculated
    const available = campaignAvailability(occupied);

    // Then checkout is closed
    expect(available).toBe(false);
  });

  it("trims and bounds first-checkout attribution", () => {
    // Given untrusted attribution values
    const raw = { utmSource: `  ${"x".repeat(140)}  `, utmMedium: " group " };

    // When attribution is normalized
    const attribution = normalizeAttribution(raw);

    // Then values are trimmed and capped
    expect(attribution).toEqual({ utmSource: "x".repeat(100), utmMedium: "group" });
  });

  it("returns public commercial terms without counters", () => {
    // Given campaign terms and occupied capacity
    const campaign = {
      code: "FB15K",
      amountIdr: 15000,
      durationDays: 30,
      capacity: 500,
      isEnabled: true,
    };

    // When public status is built
    const status = publicCampaignStatus(campaign, 499);

    // Then offer terms, capacity, and available status are exposed
    expect(status).toEqual({
      code: "FB15K",
      amountIdr: 15000,
      durationDays: 30,
      capacity: 500,
      available: true,
      status: "available",
    });
  });

  it("distinguishes full capacity from a disabled campaign", () => {
    const base = {
      code: "FB15K",
      amountIdr: 15000,
      durationDays: 30,
      capacity: 500,
    };

    expect(publicCampaignStatus({ ...base, isEnabled: true }, 500)).toEqual({
      ...base,
      available: false,
      status: "full",
    });
    expect(publicCampaignStatus({ ...base, isEnabled: false }, 10)).toEqual({
      ...base,
      available: false,
      status: "unavailable",
    });
  });
});
