/**
 * UNUSED at runtime. Consumer engagement (likes / favorites / watch progress)
 * lives in localStorage via apps/consumer/src/lib/local-engagement.ts.
 * Tables may still exist in Postgres from the initial migration — do not
 * assume API routes write here. Wire server-side only when cross-device sync
 * is a real product requirement; then drop the localStorage path.
 */
import {
  pgTable,
  uuid,
  integer,
  timestamp,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { dramas, episodes } from "./catalog";

export const watchProgress = pgTable(
  "watch_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    positionSeconds: integer("position_seconds").notNull().default(0),
    durationSeconds: integer("duration_seconds"),
    isCompleted: boolean("is_completed").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.episodeId] })]
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    dramaId: uuid("drama_id")
      .notNull()
      .references(() => dramas.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dramaId] })]
);

export const episodeLikes = pgTable(
  "episode_likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.episodeId] })]
);

export const dramaRatings = pgTable(
  "drama_ratings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    dramaId: uuid("drama_id")
      .notNull()
      .references(() => dramas.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dramaId] })]
);
