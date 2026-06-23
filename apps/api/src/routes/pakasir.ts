import { Hono } from "hono";
import { createDb, payments, subscriptions, plans } from "@dramaplay/db";
import { and, eq } from "drizzle-orm";
import type { Env } from "../env";

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

  if (!paidPayment) return c.json({ ok: true });

  const [plan] = await db.select().from(plans).where(eq(plans.id, paidPayment.planId));
  if (plan) {
    const now = new Date();
    const expires = new Date(now.getTime() + plan.durationDays * 86400000);
    await db.insert(subscriptions).values({
      userId: paidPayment.userId,
      planId: plan.id,
      status: "active",
      startedAt: now,
      expiresAt: expires,
    });
  }

  return c.json({ ok: true });
});

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
