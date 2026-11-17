-- Trigram index on place names (ARCHITECTURE §6.2 / T2.2).
-- DO block avoids unique_violation races when migrate runs concurrently (CI/tests).
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE "ref"."datasets" (
	"gbif_dataset_key" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"publisher" text NOT NULL,
	"license" text NOT NULL,
	"citation" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref"."places" (
	"id" serial PRIMARY KEY NOT NULL,
	"region_id" integer NOT NULL,
	"name" text NOT NULL,
	"alt_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"kind" text NOT NULL,
	"cell_r7" text NOT NULL,
	"population" integer
);
--> statement-breakpoint
CREATE TABLE "ref"."regions" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"time_zone" text NOT NULL,
	"geom" geometry(MultiPolygon,4326) NOT NULL,
	"min_res" integer DEFAULT 3 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref"."species_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"taxon_id" integer NOT NULL,
	"region_id" integer NOT NULL,
	"body_md" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ethics_md" text,
	"legal_md" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ref"."taxa" (
	"id" serial PRIMARY KEY NOT NULL,
	"gbif_taxon_key" integer NOT NULL,
	"scientific_name" text NOT NULL,
	"common_names" jsonb NOT NULL,
	"group" text NOT NULL,
	"effort_group" text NOT NULL,
	"coastal" boolean DEFAULT false NOT NULL,
	"tide_pref" text,
	"activity_pattern" text,
	"challenge_eligible" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref"."taxon_region" (
	"taxon_id" integer NOT NULL,
	"region_id" integer NOT NULL,
	"tier" text NOT NULL,
	"lockout_months" integer[] DEFAULT '{}'::int[] NOT NULL,
	"reviewer" text,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "taxon_region_taxon_id_region_id_pk" PRIMARY KEY("taxon_id","region_id")
);
--> statement-breakpoint
CREATE TABLE "ref"."zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"region_id" integer NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"geom" geometry(MultiPolygon,4326) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ref"."places" ADD CONSTRAINT "places_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "ref"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref"."species_cards" ADD CONSTRAINT "species_cards_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "ref"."taxa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref"."species_cards" ADD CONSTRAINT "species_cards_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "ref"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref"."taxon_region" ADD CONSTRAINT "taxon_region_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "ref"."taxa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref"."taxon_region" ADD CONSTRAINT "taxon_region_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "ref"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref"."zones" ADD CONSTRAINT "zones_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "ref"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "places_name_trgm_idx" ON "ref"."places" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "places_cell_r7_idx" ON "ref"."places" USING btree ("cell_r7");--> statement-breakpoint
CREATE UNIQUE INDEX "regions_slug_uidx" ON "ref"."regions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "regions_geom_gix" ON "ref"."regions" USING gist ("geom");--> statement-breakpoint
CREATE UNIQUE INDEX "taxa_gbif_taxon_key_uidx" ON "ref"."taxa" USING btree ("gbif_taxon_key");--> statement-breakpoint
CREATE INDEX "zones_geom_gix" ON "ref"."zones" USING gist ("geom");