-- Enable PostGIS on first container init (empty volume only).
-- Apply to both the app DB and the default `postgres` DB so the T0.4
-- acceptance command (`psql -U postgres -c "SELECT postgis_full_version();"`)
-- works without needing `-d wildwindow`.
CREATE EXTENSION IF NOT EXISTS postgis;
\c postgres
CREATE EXTENSION IF NOT EXISTS postgis;
