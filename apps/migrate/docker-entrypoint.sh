#!/bin/sh
# Apply Drizzle migrations (+ §6.3 roles when passwords are set).
# Optional: RUN_SEED=1 also runs pnpm db:seed.
set -eu
cd /app
echo "Running migrations..."
pnpm --filter @wildwindow/db migrate
if [ "${RUN_SEED:-0}" = "1" ]; then
  echo "Running seeds (RUN_SEED=1)..."
  pnpm --filter @wildwindow/db seed
fi
echo "migrate finished OK"
