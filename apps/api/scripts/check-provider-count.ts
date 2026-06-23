import { createDb, providers, dramaProviders, dramas } from "@dramaplay/db";
import { eq, and, count } from "drizzle-orm";
const code = process.argv[2] || "dramaboxbaru";
const db = createDb(process.env.DATABASE_URL!);
const [p] = await db.select().from(providers).where(eq(providers.code, code));
console.log("provider", p?.id, p?.isEnabled, p?.lastSyncAt, p?.lastSyncStatus);
if (p) {
  const [c] = await db
    .select({ n: count() })
    .from(dramaProviders)
    .innerJoin(dramas, eq(dramaProviders.dramaId, dramas.id))
    .where(and(eq(dramaProviders.providerId, p.id), eq(dramas.visibility, "public")));
  console.log("count", c.n);
}
process.exit(0);
