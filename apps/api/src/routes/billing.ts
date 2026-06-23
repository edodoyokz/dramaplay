import { Hono } from "hono";
import { createDb, plans, payments, subscriptions } from "@dramaplay/db";
import { and, asc, eq } from "drizzle-orm";
import type { Env } from "../env";
import { authMiddleware } from "../middleware/auth";

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
  const userId = c.get("user").id;
  const { planCode } = await c.req.json<{ planCode: string }>();

  const db = createDb(c.env.DATABASE_URL);
  const [plan] = await db.select().from(plans).where(eq(plans.code, planCode));
  if (!plan) return c.json({ error: "plan_not_found" }, 404);

  const [payment] = await db
    .insert(payments)
    .values({
      userId,
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
    const now = new Date();
    await db.insert(subscriptions).values({
      userId,
      planId: plan.id,
      status: "active",
      startedAt: now,
      expiresAt: new Date(now.getTime() + plan.durationDays * 86400000),
    });
  }
}

async function verifyTransaction(env: Env, orderId: string, amount: number) {
  const url = new URL("https://app.pakasir.com/api/transactiondetail");
  url.searchParams.set("project", env.PAKASIR_PROJECT_SLUG);
  url.searchParams.set("amount", String(amount));
  url.searchParams.set("order_id", orderId);
  url.searchParams.set("api_key", env.PAKASIR_API_KEY);

  const res = await fetch(url);
  if (!res.ok) return false;
  const data = await res.json<{
    transaction?: { status?: string; amount?: number; order_id?: string; project?: string };
  }>();
  const trx = data.transaction;
  return (
    trx?.status === "completed" &&
    trx.amount === amount &&
    trx.order_id === orderId &&
    trx.project === env.PAKASIR_PROJECT_SLUG
  );
}
