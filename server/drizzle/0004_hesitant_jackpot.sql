CREATE TABLE "played_predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lottery" varchar(40) NOT NULL,
	"draw_date" date NOT NULL,
	"prediction_id" integer NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "played_predictions" ADD CONSTRAINT "played_predictions_prediction_id_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."predictions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "played_predictions_lottery_draw_prediction_unique" ON "played_predictions" USING btree ("lottery","draw_date","prediction_id");