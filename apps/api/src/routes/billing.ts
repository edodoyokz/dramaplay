import { Hono } from "hono";
import { createDb, plans, payments } from "@dramaplay/db";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import { authMiddleware } from "../middleware/auth";

export const billing = new Hono<{ Bindings: Env }>();

billing.get("/plans", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db.select().from(plans).where(eq(plans.isEnabled, true));
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
    .values({ userId, planId: plan.id, amountIdr: plan.priceIdr, status: "pending" })
    .returning();

  // TODO: create real Pakasir transaction via Pakasir SDK/API and store reference.
  const checkoutUrl = `https://pakasir.example.com/checkout?ref=${payment.id}`;

  return c.json({ paymentId: payment.id, checkoutUrl });
});

billing.get("/me", authMiddleware, async (c) => {
  const userId = c.get("user").id;
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(payments.createdAt);
  return c.json({ items: rows });
});
