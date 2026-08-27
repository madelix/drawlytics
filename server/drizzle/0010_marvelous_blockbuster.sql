CREATE TABLE "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "clerk_user_id" varchar(255) NOT NULL,
  "email" varchar(255),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE UNIQUE INDEX "users_clerk_user_id_unique"
ON "users" USING btree ("clerk_user_id");