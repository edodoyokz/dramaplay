import { createDb } from "./client";
import { plans, providers } from "./schema";

async function main() {
  const db = createDb(process.env.DATABASE_URL!);

  await db
    .insert(plans)
    .values([
      { code: "vip_weekly", name: "VIP Mingguan", durationDays: 7, priceIdr: 15000 },
      { code: "vip_monthly", name: "VIP Bulanan", durationDays: 30, priceIdr: 49000 },
    ])
    .onConflictDoNothing({ target: plans.code });

  await db
    .insert(providers)
    .values([
      { code: "dramabox", name: "DramaBox", priority: 10, isEnabled: true },
      { code: "shortmax", name: "ShortMax", priority: 20, isEnabled: true },
      // ponytail: disabled until its Sansekai endpoint shape is wired.
      { code: "reelshort", name: "ReelShort", priority: 30, isEnabled: false },
    ])
    .onConflictDoNothing({ target: providers.code });

  await db.$client.end();
  console.log("seed done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
