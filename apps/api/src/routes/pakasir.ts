import { Hono } from "hono";
import { createDb, payments, plans } from "@dramaplay/db";
import { and, eq } from "drizzle-orm";
import type { Env } from "../env";
import { grantOrExtendSubscription } from "../lib/entitlements";
import { verifyTransaction } from "../lib/pakasir";

export const pakasir = new Hono<{ Bindings: Env }>();

pakasir.post("/webhook", async (c) => {
  const body = await c.req.json<{
    amount: number;
    order_id: string;
    project: string;
    status: "completed" | string;
    payment_method?: string;
    completed_at?: string;
  }>();

  if (body.project !== c.env.PAKASIR_PROJECT_SLUG) return c.json({ error: "invalid_project" }, 400);

  const db = createDb(c.env.DATABASE_URL);
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.pakasirReference, body.order_id));
  if (!payment) return c.json({ error: "not_found" }, 404);
  if (payment.amountIdr !== body.amount) return c.json({ error: "invalid_amount" }, 400);
  if (payment.status === "paid") return c.json({ ok: true });

  const verified = await verifyTransaction(c.env, body.order_id, body.amount);
  if (!verified) return c.json({ error: "transaction_not_completed" }, 400);

  const [paidPayment] = await db
    .update(payments)
    .set({
      status: "paid",
      pakasirTransactionId: body.order_id,
      payload: JSON.stringify(body),
      paidAt: body.completed_at ? new Date(body.completed_at) : new Date(),
    })
    .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")))
    .returning();

  // Lost race with another webhook/reconcile — payment already paid.
  if (!paidPayment) return c.json({ ok: true });

  const [plan] = await db.select().from(plans).where(eq(plans.id, paidPayment.planId));
  if (plan) {
    await grantOrExtendSubscription(db, {
      userId: paidPayment.userId,
      planId: plan.id,
      durationDays: plan.durationDays,
    });
  }

  return c.json({ ok: true });
});
