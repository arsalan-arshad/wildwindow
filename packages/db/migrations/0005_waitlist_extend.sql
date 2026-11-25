ALTER TABLE "app"."waitlist" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "app"."waitlist" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "app"."waitlist" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "app"."waitlist" ADD COLUMN "favourite_species" text;--> statement-breakpoint
ALTER TABLE "app"."waitlist" ADD COLUMN "consent_at" timestamp with time zone;--> statement-breakpoint
UPDATE "app"."waitlist" SET "email" = lower(trim("email"));--> statement-breakpoint
UPDATE "app"."waitlist" SET "consent_at" = "created_at" WHERE "consent_at" IS NULL;--> statement-breakpoint
ALTER TABLE "app"."waitlist" ALTER COLUMN "consent_at" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "app"."waitlist_email_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_email_lower_uidx" ON "app"."waitlist" USING btree (lower("email"));
