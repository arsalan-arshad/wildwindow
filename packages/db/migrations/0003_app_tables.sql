CREATE TABLE "app"."audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."challenge_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"logbook_entry_id" integer NOT NULL,
	"country_code" text NOT NULL,
	"region_label" text NOT NULL,
	"photo_key" text NOT NULL,
	"pledge_accepted_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reject_reason" text,
	"publish_after" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"taxon_id" integer NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"rules_md" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."entitlements" (
	"user_id" uuid NOT NULL,
	"entitlement" text NOT NULL,
	"source" text NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "entitlements_user_id_entitlement_pk" PRIMARY KEY("user_id","entitlement")
);
--> statement-breakpoint
CREATE TABLE "app"."ingest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"region_id" integer NOT NULL,
	"kind" text NOT NULL,
	"gbif_download_key" text,
	"doi" text,
	"status" text NOT NULL,
	"total" integer,
	"loaded" integer,
	"rejected_licence" integer,
	"rejected_coords" integer,
	"rejected_other" integer,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."logbook_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"taxon_id" integer,
	"taken_at" timestamp with time zone NOT NULL,
	"cell_r7" text,
	"exact_point_enc" bytea,
	"photo_key" text NOT NULL,
	"thumb_key" text,
	"exif" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" text NOT NULL,
	"display_name" text,
	"home_region_id" integer,
	"locale" text DEFAULT 'en' NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"region_slug" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"taxon_id" integer NOT NULL,
	"cell_r7" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."challenge_entries" ADD CONSTRAINT "challenge_entries_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "app"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."challenge_entries" ADD CONSTRAINT "challenge_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."challenge_entries" ADD CONSTRAINT "challenge_entries_logbook_entry_id_logbook_entries_id_fk" FOREIGN KEY ("logbook_entry_id") REFERENCES "app"."logbook_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."challenges" ADD CONSTRAINT "challenges_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "ref"."taxa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ingest_runs" ADD CONSTRAINT "ingest_runs_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "ref"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."logbook_entries" ADD CONSTRAINT "logbook_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."logbook_entries" ADD CONSTRAINT "logbook_entries_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "ref"."taxa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."users" ADD CONSTRAINT "users_home_region_id_regions_id_fk" FOREIGN KEY ("home_region_id") REFERENCES "ref"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."watchlist" ADD CONSTRAINT "watchlist_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "ref"."taxa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "challenges_slug_uidx" ON "app"."challenges" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_firebase_uid_uidx" ON "app"."users" USING btree ("firebase_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_email_uidx" ON "app"."waitlist" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_user_taxon_cell_uidx" ON "app"."watchlist" USING btree ("user_id","taxon_id","cell_r7");--> statement-breakpoint
ALTER TABLE "raw"."occurrences" ADD CONSTRAINT "occurrences_ingest_run_id_ingest_runs_id_fk" FOREIGN KEY ("ingest_run_id") REFERENCES "app"."ingest_runs"("id") ON DELETE no action ON UPDATE no action;