#!/bin/sh
# Apply Drizzle migrations (+ §6.3 roles when passwords are set).
# Optional: RUN_SEED=1 also runs compiled seed (packages/db/dist/seed.js).
# Uses node (not pnpm/corepack) so non-root USER ww has no ~/.cache write needs.
set -eu
cd /app
echo "Running migrations..."
node packages/db/dist/migrate.js
if [ "${RUN_SEED:-0}" = "1" ]; then
  echo "Running seeds (RUN_SEED=1)..."
  node packages/db/dist/seed.js
fi
echo "migrate finished OK"
