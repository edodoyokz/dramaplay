import { Hono } from "hono";
import { createDb, plans, payments, coupons, couponRedemptions } from "@dramaplay/db";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Env } from "../env";
import { authMiddleware, ensureProfile } from "../middleware/auth";
import { grantOrExtendSubscription } from "../lib/entitlements";
import { verifyTransaction } from "../lib/pakasir";

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

billing.post("/checkout", authMiddleware, async (c) => {
  const user = c.get("user");
  await ensureProfile(c.env, user);
  const { planCode } = await c.req.json<{ planCode: string }>();

  const db = createDb(c.env.DATABASE_URL);
  const [plan] = await db.select().from(plans).where(eq(plans.code, planCode));
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

    const [paidPayment] = await db
      .update(payments)
      .set({
        status: "paid",
        pakasirTransactionId: payment.pakasirReference,
        paidAt: new Date(),
      })
      .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")))
      .returning();
    if (!paidPayment) continue;

    const [plan] = await db.select().from(plans).where(eq(plans.id, paidPayment.planId));
    if (!plan) continue;
    await grantOrExtendSubscription(db, {
      userId,
      planId: plan.id,
      durationDays: plan.durationDays,
    });
  }
}
