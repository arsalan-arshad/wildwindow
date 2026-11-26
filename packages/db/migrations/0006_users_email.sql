ALTER TABLE "app"."users" ADD COLUMN "email" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uidx" ON "app"."users" USING btree (lower("email")) WHERE "email" IS NOT NULL;
