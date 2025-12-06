ALTER TABLE "predictions" ALTER COLUMN "lottery" SET DATA TYPE varchar(40);--> statement-breakpoint
ALTER TABLE "predictions" ALTER COLUMN "lottery" DROP DEFAULT;