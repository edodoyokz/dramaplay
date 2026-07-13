import { createDb, subscriptions, type Database } from "@dramaplay/db";
import { and, desc, eq, gt } from "drizzle-orm";

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function isUserVip(dbOrUrl: string | Database, userId: string): Promise<boolean> {
  const db = typeof dbOrUrl === "string" ? createDb(dbOrUrl) : dbOrUrl;
  const [sub] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        gt(subscriptions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(sub);
}

/** Extend from remaining VIP time, otherwise from now. */
export function nextExpiry(now: Date, durationDays: number, existingExpiresAt?: Date | null): Date {
  const baseMs =
    existingExpiresAt && existingExpiresAt.getTime() > now.getTime()
      ? existingExpiresAt.getTime()
      : now.getTime();
  return new Date(baseMs + durationDays * 86_400_000);
}

/**
 * One active VIP window per user: extend if still valid, else insert.
 * Call only after payment/coupon is already committed.
 */
export async function grantOrExtendSubscription(
  db: Database | DatabaseTransaction,
  args: { userId: string; planId: string; durationDays: number },
): Promise<{ id: string; expiresAt: Date }> {
  const now = new Date();
  const [active] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, args.userId),
        eq(subscriptions.status, "active"),
        gt(subscriptions.expiresAt, now),
      ),
    )
    .orderBy(desc(subscriptions.expiresAt))
    .limit(1);

  if (active) {
    const expiresAt = nextExpiry(now, args.durationDays, active.expiresAt);
    const [updated] = await db
      .update(subscriptions)
      .set({ planId: args.planId, expiresAt, updatedAt: now })
      .where(eq(subscriptions.id, active.id))
      .returning({ id: subscriptions.id, expiresAt: subscriptions.expiresAt });
    return updated;
  }

  const expiresAt = nextExpiry(now, args.durationDays, null);
  const [created] = await db
    .insert(subscriptions)
    .values({
      userId: args.userId,
      planId: args.planId,
      status: "active",
      startedAt: now,
      expiresAt,
    })
    .returning({ id: subscriptions.id, expiresAt: subscriptions.expiresAt });
  return created;
}
