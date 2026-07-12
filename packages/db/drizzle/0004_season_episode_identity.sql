ALTER TABLE "episodes" ADD COLUMN "season_number" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
UPDATE "episodes" AS e
SET "season_number" = split_part(ep.provider_episode_id, ':', 2)::integer
FROM "episode_providers" AS ep
JOIN "providers" AS p ON p.id = ep.provider_id
WHERE ep.episode_id = e.id
  AND p.code = 'moviebox'
  AND ep.provider_episode_id ~ '^[^:]+:[0-9]+:[0-9]+$';
--> statement-breakpoint
-- Production MovieBox syncs created duplicate (drama, season, episode) rows that
-- all share the same provider_episode_id. Keep the oldest row; cascade removes
-- episode_providers / stream cache / progress for the discarded rows.
WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY drama_id, season_number, episode_number
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM episodes
)
DELETE FROM episodes e
USING ranked r
WHERE e.id = r.id AND r.rn > 1;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "episodes"
    GROUP BY "drama_id", "season_number", "episode_number"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate episode identity after season backfill; inspect rows before retrying migration';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_nonnegative_ck" CHECK ("season_number" >= 0);
--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_episode_positive_ck" CHECK ("episode_number" > 0);
--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_drama_season_episode_uq" ON "episodes" USING btree ("drama_id","season_number","episode_number");
