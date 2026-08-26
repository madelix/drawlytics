CREATE TABLE "prediction_draw_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"prediction_id" integer NOT NULL,
	"lottery" varchar(32) NOT NULL,
	"draw_date" date NOT NULL,
	"draw_sequence" smallint DEFAULT 1 NOT NULL,
	"matched_main" smallint NOT NULL,
	"matched_special" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prediction_draw_results" ADD CONSTRAINT "prediction_draw_results_prediction_id_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."predictions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "prediction_draw_results_prediction_draw_unique" ON "prediction_draw_results" USING btree ("prediction_id","draw_date","draw_sequence");