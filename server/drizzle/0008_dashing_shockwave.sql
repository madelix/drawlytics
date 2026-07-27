DROP INDEX IF EXISTS "uk_lotto_draws_draw_date_unique";
--> statement-breakpoint

ALTER TABLE "uk_lotto_draws"
ADD COLUMN IF NOT EXISTS "draw_sequence" smallint DEFAULT 1 NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uk_lotto_draws_draw_identity_unique"
ON "uk_lotto_draws" USING btree ("draw_date", "draw_sequence");