import { pgTable, uuid, text, integer, timestamp, boolean, unique } from "drizzle-orm/pg-core";
import { profiles } from "./users";

export const plans = pgTable("plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  durationDays: integer("duration_days").notNull(),
  priceIdr: integer("price_idr").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  status: text("status", { enum: ["active", "expired", "canceled"] }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  amountIdr: integer("amount_idr").notNull(),
  status: text("status", { enum: ["pending", "paid", "failed", "expired"] })
    .notNull()
    .default("pending"),
  pakasirReference: text("pakasir_reference"),
  pakasirTransactionId: text("pakasir_transaction_id"),
  payload: text("payload"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paidCampaigns = pgTable("paid_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  amountIdr: integer("amount_idr").notNull(),
  capacity: integer("capacity").notNull(),
  reservationHours: integer("reservation_hours").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paidCampaignReservations = pgTable(
  "paid_campaign_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => paidCampaigns.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    status: text("status", { enum: ["reserved", "paid", "expired"] })
      .notNull()
      .default("reserved"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqCampaignUser: unique().on(table.campaignId, table.userId),
    uniqPayment: unique().on(table.paymentId),
  }),
);

// Launch trial coupons: redeeming grants a free subscription for the linked
// plan's duration. Free-only by design (no Pakasir discount path) — a 100%
// discount on the daily plan is just a free day.
// ponytail: single coupon table + redemptions table is the minimal honest
// model. Add per-coupon discount % only if paid-discount coupons are needed.
export const coupons = pgTable("coupons", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  maxRedemptions: integer("max_redemptions"), // null = unlimited
  redemptionCount: integer("redemption_count").notNull().default(0),
  isEnabled: boolean("is_enabled").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // One redemption per user per coupon.
  (t) => ({ uniqUserCoupon: unique().on(t.couponId, t.userId) }),
);
