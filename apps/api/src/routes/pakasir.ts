import { Hono } from "hono";
import { createDb, payments, subscriptions, plans } from "@dramaplay/db";
import { eq } from "drizzle-orm";
import type { Env } from "../env";

export const pakasir = new Hono<{ Bindings: Env }>();

pakasir.post("/webhook", async (c) => {
  const signature = c.req.header("x-pakasir-signature") ?? "";
  if (signature !== c.env.PAKASIR_WEBHOOK_SECRET) {
    return c.json({ error: "invalid_signature" }, 401);
  }

  const body = await c.req.json<{
    reference: string;
    status: "paid" | "failed" | "expired";
    pakasirTransactionId: string;
  }>();

  const db = createDb(c.env.DATABASE_URL);
  const [payment] = await db.select().from(payments).where(eq(payments.id, body.reference));
  if (!payment) return c.json({ error: "not_found" }, 404);

  if (body.status === "paid") {
    await db
      .update(payments)
      .set({
        status: "paid",
        pakasirTransactionId: body.pakasirTransactionId,
        paidAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    const [plan] = await db.select().from(plans).where(eq(plans.id, payment.planId));
    if (plan) {
      const now = new Date();
      const expires = new Date(now.getTime() + plan.durationDays * 86400000);
      await db.insert(subscriptions).values({
        userId: payment.userId,
        planId: plan.id,
        status: "active",
        startedAt: now,
        expiresAt: expires,
      });
    }
    return c.json({ ok: true });
  }

  await db
    .update(payments)
    .set({ status: body.status })
    .where(eq(payments.id, payment.id));
  return c.json({ ok: true });
});
