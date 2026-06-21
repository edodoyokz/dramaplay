import { createDb, subscriptions } from "@dramaplay/db";
import { and, eq, gt } from "drizzle-orm";

export async function isUserVip(dbUrl: string, userId: string): Promise<boolean> {
  const db = createDb(dbUrl);
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        gt(subscriptions.expiresAt, new Date())
      )
    )
    .limit(1);
  return Boolean(sub);
}
