CREATE UNIQUE INDEX IF NOT EXISTS "payments_pakasir_reference_unique"
ON "payments" ("pakasir_reference")
WHERE "pakasir_reference" IS NOT NULL;
