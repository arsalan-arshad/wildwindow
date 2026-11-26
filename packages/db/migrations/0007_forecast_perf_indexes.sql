-- T9.8: forecast history lookups filter by region_id + week + cell neighbourhood,
-- which are not leading columns of the existing primary keys.
CREATE INDEX "taxon_cell_week_taxon_region_week_cell_idx" ON "pub"."taxon_cell_week" USING btree ("taxon_id","region_id","week","cell");--> statement-breakpoint
CREATE INDEX "effort_cell_week_group_region_week_cell_idx" ON "pub"."effort_cell_week" USING btree ("effort_group","region_id","week","cell");
