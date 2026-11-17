CREATE TABLE "pub"."effort_cell_week" (
	"effort_group" text NOT NULL,
	"region_id" integer NOT NULL,
	"res" smallint NOT NULL,
	"cell" text NOT NULL,
	"week" smallint NOT NULL,
	"n_records" integer NOT NULL,
	CONSTRAINT "effort_cell_week_effort_group_res_cell_week_pk" PRIMARY KEY("effort_group","res","cell","week")
);
--> statement-breakpoint
CREATE TABLE "pub"."forecast_cache" (
	"taxon_id" integer NOT NULL,
	"display_cell" text NOT NULL,
	"start_date" date NOT NULL,
	"scoring_version" text NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "forecast_cache_taxon_id_display_cell_start_date_scoring_version_pk" PRIMARY KEY("taxon_id","display_cell","start_date","scoring_version")
);
--> statement-breakpoint
CREATE TABLE "raw"."occurrences" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_record_id" text NOT NULL,
	"taxon_id" integer NOT NULL,
	"region_id" integer NOT NULL,
	"geom" geometry(Point,4326) NOT NULL,
	"uncertainty_m" integer,
	"event_date" date NOT NULL,
	"year" integer NOT NULL,
	"week" smallint NOT NULL,
	"hour" smallint,
	"license" text NOT NULL,
	"dataset_key" text NOT NULL,
	"observer_hash" text NOT NULL,
	"ingest_run_id" integer
);
--> statement-breakpoint
CREATE TABLE "pub"."taxon_cell_week" (
	"taxon_id" integer NOT NULL,
	"region_id" integer NOT NULL,
	"res" smallint NOT NULL,
	"cell" text NOT NULL,
	"week" smallint NOT NULL,
	"n_records" integer NOT NULL,
	"n_observers" integer NOT NULL,
	"years_covered" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "taxon_cell_week_taxon_id_res_cell_week_pk" PRIMARY KEY("taxon_id","res","cell","week")
);
--> statement-breakpoint
CREATE TABLE "pub"."taxon_hour_profile" (
	"taxon_id" integer NOT NULL,
	"region_id" integer NOT NULL,
	"hour" smallint NOT NULL,
	"n_records" integer NOT NULL,
	CONSTRAINT "taxon_hour_profile_taxon_id_region_id_hour_pk" PRIMARY KEY("taxon_id","region_id","hour")
);
--> statement-breakpoint
CREATE TABLE "pub"."taxon_region_week" (
	"taxon_id" integer NOT NULL,
	"region_id" integer NOT NULL,
	"week" smallint NOT NULL,
	"n_records" integer NOT NULL,
	"n_effort" integer NOT NULL,
	CONSTRAINT "taxon_region_week_taxon_id_region_id_week_pk" PRIMARY KEY("taxon_id","region_id","week")
);
--> statement-breakpoint
CREATE TABLE "pub"."taxon_score_ref" (
	"taxon_id" integer NOT NULL,
	"region_id" integer NOT NULL,
	"rr_ref" double precision NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"scoring_version" text NOT NULL,
	CONSTRAINT "taxon_score_ref_taxon_id_region_id_pk" PRIMARY KEY("taxon_id","region_id")
);
--> statement-breakpoint
CREATE TABLE "pub"."weather_cache" (
	"provider" text NOT NULL,
	"cell_r5" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "weather_cache_provider_cell_r5_pk" PRIMARY KEY("provider","cell_r5")
);
--> statement-breakpoint
ALTER TABLE "pub"."effort_cell_week" ADD CONSTRAINT "effort_cell_week_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "ref"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pub"."forecast_cache" ADD CONSTRAINT "forecast_cache_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "ref"."taxa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw"."occurrences" ADD CONSTRAINT "occurrences_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "ref"."taxa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw"."occurrences" ADD CONSTRAINT "occurrences_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "ref"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pub"."taxon_cell_week" ADD CONSTRAINT "taxon_cell_week_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "ref"."taxa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pub"."taxon_cell_week" ADD CONSTRAINT "taxon_cell_week_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "ref"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pub"."taxon_hour_profile" ADD CONSTRAINT "taxon_hour_profile_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "ref"."taxa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pub"."taxon_hour_profile" ADD CONSTRAINT "taxon_hour_profile_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "ref"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pub"."taxon_region_week" ADD CONSTRAINT "taxon_region_week_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "ref"."taxa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pub"."taxon_region_week" ADD CONSTRAINT "taxon_region_week_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "ref"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pub"."taxon_score_ref" ADD CONSTRAINT "taxon_score_ref_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "ref"."taxa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pub"."taxon_score_ref" ADD CONSTRAINT "taxon_score_ref_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "ref"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "occurrences_source_record_uidx" ON "raw"."occurrences" USING btree ("source","source_record_id");--> statement-breakpoint
CREATE INDEX "occurrences_geom_gix" ON "raw"."occurrences" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "occurrences_taxon_region_week_idx" ON "raw"."occurrences" USING btree ("taxon_id","region_id","week");