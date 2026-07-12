import { sql } from "drizzle-orm";
import { createDb } from "./client";
import { plans, providers } from "./schema";

async function main() {
  const db = createDb(process.env.DATABASE_URL!);

  await db
    .insert(plans)
    .values([
      { code: "vip_daily", name: "VIP Harian", durationDays: 1, priceIdr: 5000 },
      { code: "vip_weekly", name: "VIP Mingguan", durationDays: 7, priceIdr: 15000 },
      { code: "vip_monthly", name: "VIP Bulanan", durationDays: 30, priceIdr: 39000 },
    ])
    .onConflictDoNothing({ target: plans.code });

  await db
    .insert(providers)
    .values([
      // ponytail: logoUrl lives in config.logoUrl; frontend falls back to
      // generated initials when unset, so logos can be added later without a
      // migration. Batch-1 Sapimu providers seeded disabled; enable one-by-one
      // after live smoke testing passes (smoke-sapimu-providers.ts).
      {
        code: "dramabox",
        name: "DramaBox",
        priority: 10,
        isEnabled: true,
        config: { logoUrl: "/logos/dramabox.png" },
      },
      {
        code: "shortmax",
        name: "ShortMax",
        priority: 20,
        isEnabled: true,
        config: { logoUrl: "/logos/shortmax.png" },
      },
      {
        code: "reelshort",
        name: "ReelShort",
        priority: 30,
        isEnabled: false,
        config: { logoUrl: "/logos/reelshort.png" },
      },
      {
        code: "dramaboxbaru",
        name: "DramaBox Baru",
        priority: 31,
        isEnabled: false,
        config: { logoUrl: "/logos/dramaboxbaru.png" },
      },
      {
        code: "dramawave",
        name: "DramaWave",
        priority: 32,
        isEnabled: false,
        config: { logoUrl: "/logos/dramawave.png" },
      },
      {
        code: "pinedrama",
        name: "PineDrama",
        priority: 33,
        isEnabled: false,
        config: { logoUrl: "/logos/pinedrama.png" },
      },
      {
        code: "netshort",
        name: "NetShort",
        priority: 34,
        isEnabled: false,
        config: { logoUrl: "/logos/netshort.png" },
      },
      {
        code: "dramanova",
        name: "DramaNova",
        priority: 35,
        isEnabled: false,
        config: { logoUrl: "/logos/dramanova.png" },
      },
      {
        code: "melolo",
        name: "Melolo",
        priority: 36,
        isEnabled: false,
        config: { logoUrl: "/logos/melolo.png" },
      },
      {
        code: "freereels",
        name: "FreeReels",
        priority: 37,
        isEnabled: false,
        config: { logoUrl: "/logos/freereels.png" },
      },
      {
        code: "idrama",
        name: "iDrama",
        priority: 38,
        isEnabled: true,
        config: { logoUrl: "/logos/idrama.png" },
      },
      {
        code: "wetv",
        name: "WeTV",
        priority: 40,
        isEnabled: true,
        config: { logoUrl: "/logos/wetv.png", contentType: "longform" },
      },
      {
        code: "moviebox",
        name: "MovieBox",
        priority: 41,
        isEnabled: true,
        config: { logoUrl: "/logos/moviebox.png", contentType: "longform" },
      },
    ])
    .onConflictDoUpdate({
      target: providers.code,
      set: {
        config: sql`excluded.config`,
      },
    });

  await db.$client.end();
  console.log("seed done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
