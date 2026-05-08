CREATE TABLE "uk_lotto_draws" (
	"id" serial PRIMARY KEY NOT NULL,
	"draw_date" date NOT NULL,
	"n1" smallint NOT NULL,
	"n2" smallint NOT NULL,
	"n3" smallint NOT NULL,
	"n4" smallint NOT NULL,
	"n5" smallint NOT NULL,
	"n6" smallint NOT NULL,
	"bonus_ball" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);