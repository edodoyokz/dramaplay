import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  real,
  primaryKey,
} from "drizzle-orm/pg-core";

export const providers = pgTable("providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  baseUrl: text("base_url"),
  priority: integer("priority").notNull().default(100),
  isEnabled: boolean("is_enabled").notNull().default(true),
  config: jsonb("config").$type<Record<string, unknown>>().default({}).notNull(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status", {
    enum: ["success", "partial", "failed", "running"],
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dramas = pgTable("dramas", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  originalTitle: text("original_title"),
  synopsis: text("synopsis"),
  posterUrl: text("poster_url"),
  backdropUrl: text("backdrop_url"),
  country: text("country"),
  language: text("language"),
  year: integer("year"),
  genres: text("genres").array().default([]).notNull(),
  tags: text("tags").array().default([]).notNull(),
  episodeCount: integer("episode_count").default(0).notNull(),
  rating: real("rating").default(0).notNull(),
  popularityScore: real("popularity_score").default(0).notNull(),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(true),
  isBroken: boolean("is_broken").notNull().default(false),
  visibility: text("visibility", { enum: ["public", "hidden"] })
    .notNull()
    .default("public"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dramaProviders = pgTable(
  "drama_providers",
  {
    dramaId: uuid("drama_id")
      .notNull()
      .references(() => dramas.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    providerDramaId: text("provider_drama_id").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.dramaId, t.providerId] })]
);

export const episodes = pgTable("episodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  dramaId: uuid("drama_id")
    .notNull()
    .references(() => dramas.id, { onDelete: "cascade" }),
  episodeNumber: integer("episode_number").notNull(),
  title: text("title"),
  thumbnailUrl: text("thumbnail_url"),
  durationSeconds: integer("duration_seconds"),
  accessType: text("access_type", { enum: ["free", "vip"] }).notNull().default("free"),
  isBroken: boolean("is_broken").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const episodeProviders = pgTable(
  "episode_providers",
  {
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    providerEpisodeId: text("provider_episode_id").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.episodeId, t.providerId] })]
);
