import { eq } from "drizzle-orm";
import { createDb } from "./client";
import { plans, coupons } from "./schema";

// Usage:
//   tsx src/create-coupon.ts CODE [planCode] [maxRedemptions] [expiresInDays]
// Examples:
//   tsx src/create-coupon.ts GRATIS1HARI                 -> vip_daily, unlimited, no expiry
//   tsx src/create-coupon.ts LAUNCH50 vip_daily 50 30    -> 50 uses, expires in 30 days
async function main() {
  const [, , codeArg, planCode = "vip_daily", maxArg, expiresDaysArg] = process.argv;
  if (!codeArg) {
    console.error("Usage: tsx src/create-coupon.ts CODE [planCode] [maxRedemptions] [expiresInDays]");
    process.exit(1);
  }
  const code = codeArg.trim().toUpperCase();
  const maxRedemptions = maxArg ? Number(maxArg) : null;
  const expiresAt = expiresDaysArg
    ? new Date(Date.now() + Number(expiresDaysArg) * 86400000)
    : null;

  const db = createDb(process.env.DATABASE_URL!);
  const [plan] = await db.select().from(plans).where(eq(plans.code, planCode));
  if (!plan) {
    console.error(`Plan not found: ${planCode}`);
    process.exit(1);
  }

  const [row] = await db
    .insert(coupons)
    .values({ code, planId: plan.id, maxRedemptions, expiresAt })
    .onConflictDoUpdate({
      target: coupons.code,
      set: { planId: plan.id, maxRedemptions, expiresAt, isEnabled: true, updatedAt: new Date() },
    })
    .returning();

  await db.$client.end();
  console.log("coupon ready:", {
    code: row.code,
    plan: `${plan.name} (${plan.durationDays}d)`,
    maxRedemptions: row.maxRedemptions ?? "unlimited",
    expiresAt: row.expiresAt ?? "never",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
