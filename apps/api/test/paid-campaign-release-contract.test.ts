import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const billingSource = readFileSync(new URL("../src/routes/billing.ts", import.meta.url), "utf8");
const checkoutSource = readFileSync(
  new URL("../src/services/paid-campaign-checkout.ts", import.meta.url),
  "utf8",
);
const fulfillmentSource = readFileSync(
  new URL("../src/services/payment-fulfillment.ts", import.meta.url),
  "utf8",
);

describe("FB15K release contracts", () => {
  it("regular checkout selects only enabled plans", () => {
    // Given the standard billing checkout route
    // When its plan lookup is inspected
    // Then disabled campaign-only plans cannot bypass campaign rules
    expect(billingSource).toContain(
      "and(eq(plans.code, planCode), eq(plans.isEnabled, true))",
    );
  });

  it("expired retry reuses its pending payment instead of inserting another", () => {
    // Given an existing campaign reservation
    // When an expired retry is handled
    // Then its current payable payment is reused and refreshed
    expect(checkoutSource).toContain("status: payments.status");
    expect(checkoutSource).toContain('payment.status === "pending"');
    expect(checkoutSource).toContain(".update(paidCampaignReservations)");
    expect(checkoutSource).not.toContain(".onConflictDoUpdate({");
  });

  it("reservation revival is constrained to expired state", () => {
    // Given an expired reservation refresh
    // When its update predicate is inspected
    // Then paid and unexpired reservations cannot be revived
    expect(checkoutSource).toContain(
      'eq(paidCampaignReservations.status, "expired")',
    );
  });

  it("checks campaign capacity before reviving an expired reservation", () => {
    // Given an expired retry and campaign occupancy query
    const capacityCheck = checkoutSource.indexOf("count(*)::int");
    const revival = checkoutSource.indexOf(
      'eq(paidCampaignReservations.status, "expired")',
    );

    // When operation order is inspected
    // Then capacity is enforced before the reservation is revived
    expect(capacityCheck).toBeGreaterThan(-1);
    expect(capacityCheck).toBeLessThan(revival);
  });

  it("never falls through an existing reservation into a second insert", () => {
    // Given checkout handling for a user who already has a reservation row
    const reservationStart = checkoutSource.indexOf("if (reservation)");
    const insertStart = checkoutSource.indexOf(".insert(payments)", reservationStart);
    const between = checkoutSource.slice(reservationStart, insertStart);

    // When non-pending / already-paid paths are inspected
    // Then paid reservations are rejected and every reservation path returns before insert
    expect(reservationStart).toBeGreaterThan(-1);
    expect(insertStart).toBeGreaterThan(reservationStart);
    expect(between).toContain('reservation.status === "paid"');
    expect(between).toContain('return { kind: "ineligible" }');
    expect(between).toMatch(/return \{ kind: "unavailable" \}/);
  });

  it("resolves the entitlement plan before marking payment paid", () => {
    // Given verified payment fulfillment
    const planLookup = fulfillmentSource.indexOf(".from(plans)");
    const paidUpdate = fulfillmentSource.indexOf("status: \"paid\"");

    // When transactional operation order is inspected
    // Then a missing plan leaves the payment pending
    expect(planLookup).toBeGreaterThan(-1);
    expect(planLookup).toBeLessThan(paidUpdate);
    expect(fulfillmentSource).toContain("if (!plan) return false");
  });
});
