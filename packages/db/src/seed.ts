import { createDb } from "./client";
import { plans } from "./schema";

async function main() {
  const db = createDb(process.env.DATABASE_URL!);

  await db
    .insert(plans)
    .values([
      { code: "vip_weekly", name: "VIP Mingguan", durationDays: 7, priceIdr: 15000 },
      { code: "vip_monthly", name: "VIP Bulanan", durationDays: 30, priceIdr: 49000 },
    ])
    .onConflictDoNothing({ target: plans.code });

  await db.$client.end();
  console.log("seed done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
