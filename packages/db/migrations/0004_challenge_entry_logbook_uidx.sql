CREATE UNIQUE INDEX "challenge_entries_logbook_entry_uidx" ON "app"."challenge_entries" USING btree ("logbook_entry_id");
