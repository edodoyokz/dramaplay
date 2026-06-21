import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { episodes } from "./catalog";

export const subtitles = pgTable("subtitles", {
  id: uuid("id").defaultRandom().primaryKey(),
  episodeId: uuid("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  source: text("source", { enum: ["provider", "internal"] }).notNull(),
  format: text("format", { enum: ["vtt", "srt", "embedded"] }).notNull(),
  url: text("url"),
  isDefault: boolean("is_default").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(true),
  isBroken: boolean("is_broken").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const streamResolveCache = pgTable("stream_resolve_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  episodeId: uuid("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id"),
  streamUrl: text("stream_url").notNull(),
  streamType: text("stream_type", { enum: ["mp4", "m3u8", "other"] }).notNull(),
  quality: text("quality"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }).notNull().defaultNow(),
});
