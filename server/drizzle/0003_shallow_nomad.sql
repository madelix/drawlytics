CREATE TABLE "played_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"lottery" varchar(40) NOT NULL,
	"draw_date" date NOT NULL,
	"model_name" varchar(120) NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "played_models_lottery_draw_unique" ON "played_models" USING btree ("lottery","draw_date");