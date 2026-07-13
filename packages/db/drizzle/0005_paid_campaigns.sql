CREATE TABLE "paid_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "plan_id" uuid NOT NULL,
  "amount_idr" integer NOT NULL,
  "capacity" integer NOT NULL,
  "reservation_hours" integer NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "paid_campaigns_code_unique" UNIQUE("code"),
  CONSTRAINT "paid_campaigns_amount_positive" CHECK ("amount_idr" > 0),
  CONSTRAINT "paid_campaigns_capacity_positive" CHECK ("capacity" > 0),
  CONSTRAINT "paid_campaigns_reservation_hours_positive" CHECK ("reservation_hours" > 0),
  CONSTRAINT "paid_campaigns_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("id")
);

CREATE TABLE "paid_campaign_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  "status" text DEFAULT 'reserved' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "utm_content" text,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "paid_campaign_reservations_campaign_user_unique" UNIQUE("campaign_id", "user_id"),
  CONSTRAINT "paid_campaign_reservations_payment_unique" UNIQUE("payment_id"),
  CONSTRAINT "paid_campaign_reservations_status_check" CHECK ("status" IN ('reserved', 'paid', 'expired')),
  CONSTRAINT "paid_campaign_reservations_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "paid_campaigns"("id"),
  CONSTRAINT "paid_campaign_reservations_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "paid_campaign_reservations_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
);

CREATE INDEX "paid_campaign_reservations_capacity_idx"
ON "paid_campaign_reservations" ("campaign_id", "status", "expires_at");

INSERT INTO "plans" ("code", "name", "duration_days", "price_idr", "is_enabled")
VALUES ('fb15k_30d', 'FB15K 30 Hari', 30, 15000, false)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "paid_campaigns" ("code", "plan_id", "amount_idr", "capacity", "reservation_hours", "is_enabled")
SELECT 'FB15K', "id", 15000, 500, 24, true
FROM "plans"
WHERE "code" = 'fb15k_30d'
ON CONFLICT ("code") DO NOTHING;
