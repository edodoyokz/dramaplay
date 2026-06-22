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
      // ponytail: logoUrl lives in config.logoUrl; frontend falls back to
      // generated initials when unset, so logos can be added later without a
      // migration. Batch-1 Sapimu providers seeded disabled; enable one-by-one
      // after live smoke testing passes (smoke-sapimu-providers.ts).
      { code: "dramabox", name: "DramaBox", priority: 10, isEnabled: true, config: {} },
      { code: "shortmax", name: "ShortMax", priority: 20, isEnabled: true, config: {} },
      { code: "reelshort", name: "ReelShort", priority: 30, isEnabled: false, config: {} },
      { code: "dramaboxbaru", name: "DramaBox Baru", priority: 31, isEnabled: false, config: {} },
      { code: "dramawave", name: "DramaWave", priority: 32, isEnabled: false, config: {} },
      { code: "pinedrama", name: "PineDrama", priority: 33, isEnabled: false, config: {} },
      { code: "netshort", name: "NetShort", priority: 34, isEnabled: false, config: {} },
      { code: "dramanova", name: "DramaNova", priority: 35, isEnabled: false, config: {} },
      { code: "melolo", name: "Melolo", priority: 36, isEnabled: false, config: {} },
    ])
    .onConflictDoNothing({ target: providers.code });

  await db.$client.end();
  console.log("seed done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
