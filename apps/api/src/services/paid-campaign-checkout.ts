import {
  paidCampaignReservations,
  paidCampaigns,
  payments,
  type Database,
} from "@dramaplay/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  campaignExpiry,
  normalizeAttribution,
  normalizeCampaignCode,
  type CampaignAttribution,
} from "../lib/paid-campaign";

export type CampaignCheckoutResult =
  | { readonly kind: "checkout"; readonly paymentId: string; readonly reference: string; readonly amountIdr: number }
  | { readonly kind: "unavailable" }
  | { readonly kind: "ineligible" }
  | { readonly kind: "full" };

type CheckoutRequest = {
  readonly code: string;
  readonly userId: string;
  readonly now: Date;
  readonly attribution: CampaignAttribution;
};

export async function createCampaignCheckout(
  db: Database,
  request: CheckoutRequest,
): Promise<CampaignCheckoutResult> {
  return db.transaction(async (tx) => {
    const code = normalizeCampaignCode(request.code);
    await tx.execute(sql`SELECT id FROM paid_campaigns WHERE code = ${code} FOR UPDATE`);
    const [campaign] = await tx
      .select({
        id: paidCampaigns.id,
        planId: paidCampaigns.planId,
        amountIdr: paidCampaigns.amountIdr,
        capacity: paidCampaigns.capacity,
        reservationHours: paidCampaigns.reservationHours,
        enabled: paidCampaigns.isEnabled,
      })
      .from(paidCampaigns)
      .where(eq(paidCampaigns.code, code));
    if (!campaign?.enabled) return { kind: "unavailable" };

    await tx
      .update(paidCampaignReservations)
      .set({ status: "expired", updatedAt: request.now })
      .where(
        and(
          eq(paidCampaignReservations.campaignId, campaign.id),
          eq(paidCampaignReservations.status, "reserved"),
          sql`${paidCampaignReservations.expiresAt} <= ${request.now}`,
        ),
      );

    const [priorPaid] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.userId, request.userId), eq(payments.status, "paid")))
      .limit(1);
    if (priorPaid) return { kind: "ineligible" };

    const [reservation] = await tx
      .select({
        paymentId: paidCampaignReservations.paymentId,
        status: paidCampaignReservations.status,
      })
      .from(paidCampaignReservations)
      .where(
        and(
          eq(paidCampaignReservations.campaignId, campaign.id),
          eq(paidCampaignReservations.userId, request.userId),
        ),
      );
    if (reservation) {
      if (reservation.status === "paid") return { kind: "ineligible" };
      const [payment] = await tx
        .select({
          id: payments.id,
          reference: payments.pakasirReference,
          status: payments.status,
        })
        .from(payments)
        .where(eq(payments.id, reservation.paymentId));
      if (payment?.reference && payment.status === "pending") {
        if (reservation.status === "expired") {
          const [count] = await tx
            .select({ occupied: sql<number>`count(*)::int` })
            .from(paidCampaignReservations)
            .where(
              and(
                eq(paidCampaignReservations.campaignId, campaign.id),
                inArray(paidCampaignReservations.status, ["reserved", "paid"]),
              ),
            );
          if ((count?.occupied ?? 0) >= campaign.capacity) return { kind: "full" };
          const expiresAt = campaignExpiry(request.now, campaign.reservationHours);
          const refreshed = await tx
            .update(paidCampaignReservations)
            .set({ status: "reserved", expiresAt, updatedAt: request.now })
            .where(
              and(
                eq(paidCampaignReservations.campaignId, campaign.id),
                eq(paidCampaignReservations.userId, request.userId),
                eq(paidCampaignReservations.status, "expired"),
              ),
            )
            .returning({ id: paidCampaignReservations.id });
          if (!refreshed.length) return { kind: "unavailable" };
        }
        return { kind: "checkout", paymentId: payment.id, reference: payment.reference, amountIdr: campaign.amountIdr };
      }
      return { kind: "unavailable" };
    }

    const [count] = await tx
      .select({ occupied: sql<number>`count(*)::int` })
      .from(paidCampaignReservations)
      .where(
        and(
          eq(paidCampaignReservations.campaignId, campaign.id),
          inArray(paidCampaignReservations.status, ["reserved", "paid"]),
        ),
      );
    if ((count?.occupied ?? 0) >= campaign.capacity) return { kind: "full" };

    const reference = crypto.randomUUID();
    const [payment] = await tx
      .insert(payments)
      .values({
        userId: request.userId,
        planId: campaign.planId,
        amountIdr: campaign.amountIdr,
        status: "pending",
        pakasirReference: reference,
      })
      .returning({ id: payments.id });
    if (!payment) return { kind: "unavailable" };

    const expiresAt = campaignExpiry(request.now, campaign.reservationHours);
    const attribution = normalizeAttribution(request.attribution);
    await tx
      .insert(paidCampaignReservations)
      .values({ campaignId: campaign.id, userId: request.userId, paymentId: payment.id, expiresAt, ...attribution });
    return { kind: "checkout", paymentId: payment.id, reference, amountIdr: campaign.amountIdr };
  });
}
