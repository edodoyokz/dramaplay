import { paidCampaignReservations, payments, plans, type Database } from "@dramaplay/db";
import { and, eq } from "drizzle-orm";
import { grantOrExtendSubscription } from "../lib/entitlements";

type FulfillmentState = {
  readonly paymentStatus: "pending" | "paid";
  readonly reservationStatus: "reserved" | "expired" | "paid" | null;
};

export function fulfillmentTransition(state: FulfillmentState) {
  const transition = state.paymentStatus === "pending";
  return {
    pay: transition,
    markReservationPaid: transition && state.reservationStatus !== null,
    grant: transition,
  };
}

type CompletePaymentInput = {
  readonly paymentId: string;
  readonly transactionId: string;
  readonly paidAt: Date;
  readonly payload?: string;
};

export async function completeVerifiedPayment(
  db: Database,
  input: CompletePaymentInput,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select({ planId: payments.planId })
      .from(payments)
      .where(and(eq(payments.id, input.paymentId), eq(payments.status, "pending")));
    if (!payment) return false;
    const [plan] = await tx.select().from(plans).where(eq(plans.id, payment.planId));
    if (!plan) return false;

    const [paidPayment] = await tx
      .update(payments)
      .set({
        status: "paid",
        pakasirTransactionId: input.transactionId,
        paidAt: input.paidAt,
        ...(input.payload === undefined ? {} : { payload: input.payload }),
        updatedAt: input.paidAt,
      })
      .where(and(eq(payments.id, input.paymentId), eq(payments.status, "pending")))
      .returning();
    if (!paidPayment) return false;

    await tx
      .update(paidCampaignReservations)
      .set({ status: "paid", paidAt: input.paidAt, updatedAt: input.paidAt })
      .where(eq(paidCampaignReservations.paymentId, paidPayment.id));

    await grantOrExtendSubscription(tx, {
      userId: paidPayment.userId,
      planId: plan.id,
      durationDays: plan.durationDays,
    });
    return true;
  });
}
