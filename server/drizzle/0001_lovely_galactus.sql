CREATE TABLE "predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lottery" varchar(32) DEFAULT 'euromillions' NOT NULL,
	"draw_date" date NOT NULL,
	"model_name" varchar(120) NOT NULL,
	"main_numbers" smallint[] NOT NULL,
	"star_numbers" smallint[] NOT NULL,
	"confidence" numeric(5, 2) NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"matched_main" smallint,
	"matched_stars" smallint,
	"result_label" varchar(24),
	"created_at" timestamp DEFAULT now() NOT NULL
);
