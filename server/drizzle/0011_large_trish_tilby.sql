ALTER TABLE "predictions"
ADD COLUMN "benchmark_eligible" boolean DEFAULT false NOT NULL;

UPDATE "predictions"
SET "benchmark_eligible" = true;