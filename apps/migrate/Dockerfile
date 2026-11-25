# One-shot migrate (+ optional seed) image. Build context = monorepo root.
# On Railway: run as a one-off service / manual deploy with restart disabled.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/geoprivacy/package.json packages/geoprivacy/
RUN pnpm install --frozen-lockfile --filter @wildwindow/db...

FROM deps AS build
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY packages/geoprivacy packages/geoprivacy
COPY packages/db packages/db
RUN pnpm --filter @wildwindow/geoprivacy build \
  && pnpm --filter @wildwindow/shared build \
  && pnpm --filter @wildwindow/db build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Non-root runtime. No corepack/pnpm here — entrypoint runs compiled
# `node packages/db/dist/migrate.js` (and optional seed.js) only.
RUN groupadd --system --gid 1001 ww \
  && useradd --system --uid 1001 --gid ww ww
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY data ./data
# Requires DATABASE_URL (owner). Set WW_API_DB_PASSWORD + WW_WORKER_DB_PASSWORD
# so roles are applied (§6.3). Set RUN_SEED=1 to also run seeds.
COPY apps/migrate/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
USER ww
ENTRYPOINT ["/app/docker-entrypoint.sh"]
