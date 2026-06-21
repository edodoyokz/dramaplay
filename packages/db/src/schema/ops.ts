import { pgTable, uuid, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { profiles } from "./users";

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: uuid("reporter_id").references(() => profiles.id),
  targetType: text("target_type", {
    enum: ["drama", "episode", "payment", "subtitle", "other"],
  }).notNull(),
  targetId: uuid("target_id"),
  reason: text("reason").notNull(),
  status: text("status", {
    enum: ["open", "in_progress", "resolved", "rejected"],
  })
    .notNull()
    .default("open"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const syncLogs = pgTable("sync_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id"),
  jobType: text("job_type").notNull(),
  triggerType: text("trigger_type", { enum: ["cron", "manual"] }).notNull(),
  status: text("status", {
    enum: ["success", "partial", "failed", "running"],
  }).notNull(),
  dramaNew: integer("drama_new").notNull().default(0),
  dramaUpdated: integer("drama_updated").notNull().default(0),
  episodeNew: integer("episode_new").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errorDetail: text("error_detail"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const providerHealth = pgTable("provider_health", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id"),
  status: text("status", { enum: ["healthy", "degraded", "down"] }).notNull(),
  latencyMs: integer("latency_ms"),
  errorRate: integer("error_rate"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  event: text("event").notNull(),
  properties: jsonb("properties").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => profiles.id),
  action: text("action").notNull(),
  target: text("target"),
  detail: jsonb("detail").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const editorialCollections = pgTable("editorial_collections", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  kind: text("kind", { enum: ["banner", "collection", "promo"] }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
