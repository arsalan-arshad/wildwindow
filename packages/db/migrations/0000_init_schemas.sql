-- T2.1: PostGIS + Postgres schemas (ARCHITECTURE §6.1).
-- Extension is also enabled by docker/db/init-postgis.sql on first volume init;
-- IF NOT EXISTS keeps migrate idempotent against that path.
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE SCHEMA "app";
--> statement-breakpoint
CREATE SCHEMA "pub";
--> statement-breakpoint
CREATE SCHEMA "raw";
--> statement-breakpoint
CREATE SCHEMA "ref";
