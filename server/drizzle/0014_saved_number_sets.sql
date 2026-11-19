CREATE TABLE "saved_number_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"lottery" varchar(32) NOT NULL,
	"main_numbers" smallint[] NOT NULL,
	"special_numbers" smallint[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_number_sets" ADD CONSTRAINT "saved_number_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;