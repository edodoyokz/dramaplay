import { describe, expect, it } from "vitest";
import { fulfillmentTransition } from "../src/services/payment-fulfillment";

describe("campaign payment fulfillment", () => {
  it("fulfills a pending campaign payment even after reservation expiry", () => {
    // Given a verified pending payment with an expired reservation
    const state = { paymentStatus: "pending", reservationStatus: "expired" } as const;

    // When fulfillment is evaluated
    const result = fulfillmentTransition(state);

    // Then payment, reservation, and entitlement transition once
    expect(result).toEqual({ pay: true, markReservationPaid: true, grant: true });
  });

  it("does nothing after the payment was already fulfilled", () => {
    // Given a replay for an already paid payment
    const state = { paymentStatus: "paid", reservationStatus: "paid" } as const;

    // When fulfillment is evaluated
    const result = fulfillmentTransition(state);

    // Then no entitlement is granted again
    expect(result).toEqual({ pay: false, markReservationPaid: false, grant: false });
  });
});
