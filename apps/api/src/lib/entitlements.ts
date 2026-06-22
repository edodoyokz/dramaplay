import { createDb, subscriptions, type Database } from "@dramaplay/db";
import { and, eq, gt } from "drizzle-orm";

export async function isUserVip(dbOrUrl: string | Database, userId: string): Promise<boolean> {
  const db = typeof dbOrUrl === "string" ? createDb(dbOrUrl) : dbOrUrl;
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
