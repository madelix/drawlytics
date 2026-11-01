ALTER TABLE "predictions"
ADD COLUMN IF NOT EXISTS "user_id" integer;

--> statement-breakpoint

ALTER TABLE "predictions"
ADD COLUMN IF NOT EXISTS "source" text;