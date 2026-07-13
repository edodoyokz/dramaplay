import { Hono } from "hono";
import {
  createDb,
  plans,
  payments,
  coupons,
  couponRedemptions,
  paidCampaignReservations,
  paidCampaigns,
} from "@dramaplay/db";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Env } from "../env";
import { authMiddleware, ensureProfile } from "../middleware/auth";
import { grantOrExtendSubscription } from "../lib/entitlements";
import { verifyTransaction } from "../lib/pakasir";
import {
  campaignCheckoutError,
  normalizeCampaignCode,
  parseCampaignCheckoutBody,
  publicCampaignStatus,
} from "../lib/paid-campaign";
import { createCampaignCheckout } from "../services/paid-campaign-checkout";
import { completeVerifiedPayment } from "../services/payment-fulfillment";

export const billing = new Hono<{ Bindings: Env }>();

billing.get("/plans", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db
    .select()
    .from(plans)
    .where(eq(plans.isEnabled, true))
    .orderBy(asc(plans.durationDays));
  return c.json({ items: rows });
});

billing.get("/campaigns/:code", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const code = normalizeCampaignCode(c.req.param("code"));
  const [campaign] = await db
    .select({
      id: paidCampaigns.id,
      code: paidCampaigns.code,
      amountIdr: paidCampaigns.amountIdr,
      capacity: paidCampaigns.capacity,
      isEnabled: paidCampaigns.isEnabled,
      durationDays: plans.durationDays,
    })
    .from(paidCampaigns)
    .innerJoin(plans, eq(plans.id, paidCampaigns.planId))
    .where(eq(paidCampaigns.code, code));
  if (!campaign) return c.json({ error: "campaign_not_found" }, 404);
  const [count] = await db
    .select({ occupied: sql<number>`count(*)::int` })
    .from(paidCampaignReservations)
    .where(
      and(
        eq(paidCampaignReservations.campaignId, campaign.id),
        sql`${paidCampaignReservations.status} = 'paid' OR (${paidCampaignReservations.status} = 'reserved' AND ${paidCampaignReservations.expiresAt} > now())`,
      ),
    );
  return c.json(publicCampaignStatus(campaign, count?.occupied ?? 0));
});

billing.post("/campaign-checkout", authMiddleware, async (c) => {
  const user = c.get("user");
  await ensureProfile(c.env, user);
  const body = parseCampaignCheckoutBody(await c.req.json<unknown>());
  if (!body?.code) return c.json({ error: "code_required" }, 400);
  const result = await createCampaignCheckout(createDb(c.env.DATABASE_URL), {
    code: body.code,
    userId: user.id,
    now: new Date(),
    attribution: body.attribution,
  });
  if (result.kind !== "checkout") {
    const error = campaignCheckoutError(result.kind);
    return c.json({ error: error.error }, error.status);
  }
  const checkoutUrl = new URL(`https://app.pakasir.com/pay/${c.env.PAKASIR_PROJECT_SLUG}/${result.amountIdr}`);
  checkoutUrl.searchParams.set("order_id", result.reference);
  return c.json({ paymentId: result.paymentId, checkoutUrl: checkoutUrl.toString() });
});

billing.post("/checkout", authMiddleware, async (c) => {
  const user = c.get("user");
  await ensureProfile(c.env, user);
  const { planCode } = await c.req.json<{ planCode: string }>();

  const db = createDb(c.env.DATABASE_URL);
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.code, planCode), eq(plans.isEnabled, true)));
  if (!plan) return c.json({ error: "plan_not_found" }, 404);

  const [payment] = await db
    .insert(payments)
    .values({
      userId: user.id,
      planId: plan.id,
      amountIdr: plan.priceIdr,
      status: "pending",
      pakasirReference: crypto.randomUUID(),
    })
    .returning();

  const checkoutUrl = new URL(
    `https://app.pakasir.com/pay/${c.env.PAKASIR_PROJECT_SLUG}/${payment.amountIdr}`,
  );
  checkoutUrl.searchParams.set("order_id", payment.pakasirReference ?? payment.id);

  return c.json({ paymentId: payment.id, checkoutUrl: checkoutUrl.toString() });
});

// Redeem a launch coupon -> grants a free subscription for the coupon's plan.
billing.post("/redeem", authMiddleware, async (c) => {
  const user = c.get("user");
  await ensureProfile(c.env, user);
  const { code } = await c.req.json<{ code?: string }>();
  const normalized = (code ?? "").trim().toUpperCase();
  if (!normalized) return c.json({ error: "code_required" }, 400);

  const db = createDb(c.env.DATABASE_URL);
  const [coupon] = await db.select().from(coupons).where(eq(coupons.code, normalized));
  if (!coupon || !coupon.isEnabled) return c.json({ error: "invalid_coupon" }, 404);
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return c.json({ error: "coupon_expired" }, 410);
  }
  if (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions) {
    return c.json({ error: "coupon_exhausted" }, 409);
  }

  const [plan] = await db.select().from(plans).where(eq(plans.id, coupon.planId));
  if (!plan) return c.json({ error: "plan_not_found" }, 404);

  // Atomic per-user claim: unique(coupon_id,user_id) rejects a second redemption.
  let redemptionId: string;
  try {
    const [row] = await db
      .insert(couponRedemptions)
      .values({ couponId: coupon.id, userId: user.id })
      .returning({ id: couponRedemptions.id });
    redemptionId = row.id;
  } catch {
    return c.json({ error: "already_redeemed" }, 409);
  }

  if (coupon.maxRedemptions != null) {
    const bumped = await db
      .update(coupons)
      .set({ redemptionCount: sql`${coupons.redemptionCount} + 1`, updatedAt: new Date() })
      .where(
        and(eq(coupons.id, coupon.id), sql`${coupons.redemptionCount} < ${coupon.maxRedemptions}`),
      )
      .returning({ id: coupons.id });
    if (!bumped.length) {
      await db.delete(couponRedemptions).where(eq(couponRedemptions.id, redemptionId));
      return c.json({ error: "coupon_exhausted" }, 409);
    }
  }

  const sub = await grantOrExtendSubscription(db, {
    userId: user.id,
    planId: plan.id,
    durationDays: plan.durationDays,
  });
  await db
    .update(couponRedemptions)
    .set({ subscriptionId: sub.id })
    .where(eq(couponRedemptions.id, redemptionId));

  return c.json({
    ok: true,
    planName: plan.name,
    durationDays: plan.durationDays,
    expiresAt: sub.expiresAt,
  });
});

billing.get("/me", authMiddleware, async (c) => {
  const userId = c.get("user").id;
  const db = createDb(c.env.DATABASE_URL);
  await reconcilePendingPayments(c.env, userId);
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(payments.createdAt);
  return c.json({ items: rows });
});

async function reconcilePendingPayments(env: Env, userId: string) {
  const db = createDb(env.DATABASE_URL);
  const pending = await db
    .select()
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.status, "pending")));

  for (const payment of pending) {
    if (!payment.pakasirReference) continue;
    const completed = await verifyTransaction(env, payment.pakasirReference, payment.amountIdr);
    if (!completed) continue;

    await completeVerifiedPayment(db, {
      paymentId: payment.id,
      transactionId: payment.pakasirReference,
      paidAt: new Date(),
    });
  }
}
