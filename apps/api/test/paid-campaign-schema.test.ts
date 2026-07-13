import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  paidCampaignReservations,
  paidCampaigns,
} from "@dramaplay/db";

describe("paid campaign schema", () => {
  it("seeds the promo plan disabled while enabling the campaign", () => {
    // Given the forward campaign migration
    const migration = readFileSync(
      new URL("../../../packages/db/drizzle/0005_paid_campaigns.sql", import.meta.url),
      "utf8",
    );

    // When seed values are inspected
    // Then the promo plan stays hidden while campaign checkout stays enabled
    expect(migration).toContain(
      "VALUES ('fb15k_30d', 'FB15K 30 Hari', 30, 15000, false)",
    );
    expect(migration).toContain("SELECT 'FB15K', \"id\", 15000, 500, 24, true");
  });

  it("registers the named campaign migration and current schema snapshot", () => {
    // Given Drizzle migration metadata
    const journal = readFileSync(
      new URL("../../../packages/db/drizzle/meta/_journal.json", import.meta.url),
      "utf8",
    );
    const snapshot = readFileSync(
      new URL("../../../packages/db/drizzle/meta/0005_snapshot.json", import.meta.url),
      "utf8",
    );

    // When migration registration is inspected
    // Then Drizzle points at the intended migration and records both campaign tables
    expect(journal).toContain('"tag": "0005_paid_campaigns"');
    expect(snapshot).toContain('"public.paid_campaigns"');
    expect(snapshot).toContain('"public.paid_campaign_reservations"');
  });

  it("defines immutable campaign terms", () => {
    // Given a paid campaign table
    const config = getTableConfig(paidCampaigns);

    // When its columns are inspected
    const names = config.columns.map((column) => column.name);

    // Then all server-owned commercial terms are persisted
    expect(names).toEqual(
      expect.arrayContaining([
        "code",
        "plan_id",
        "amount_idr",
        "capacity",
        "reservation_hours",
        "is_enabled",
      ]),
    );
  });

  it("uniquely links each user and payment to a reservation", () => {
    // Given the reservation table
    const config = getTableConfig(paidCampaignReservations);

    // When unique constraints and expiry are inspected
    const uniqueColumns = config.uniqueConstraints.map((constraint) =>
      constraint.columns.map((column) => column.name),
    );

    // Then one campaign/user and one payment reservation are enforced
    expect(uniqueColumns).toContainEqual(["campaign_id", "user_id"]);
    expect(uniqueColumns).toContainEqual(["payment_id"]);
    expect(config.columns.map((column) => column.name)).toContain("expires_at");
  });
});
