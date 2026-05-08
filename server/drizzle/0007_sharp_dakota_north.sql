CREATE TABLE "set_for_life_draws" (
	"id" serial PRIMARY KEY NOT NULL,
	"draw_date" date NOT NULL,
	"n1" smallint NOT NULL,
	"n2" smallint NOT NULL,
	"n3" smallint NOT NULL,
	"n4" smallint NOT NULL,
	"n5" smallint NOT NULL,
	"life_ball" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "set_for_life_draws_draw_date_unique" ON "set_for_life_draws" USING btree ("draw_date");