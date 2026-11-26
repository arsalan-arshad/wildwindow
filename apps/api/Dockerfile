# Multi-stage NestJS API image (non-root). Build context = monorepo root.
# Runtime is a tsup-bundled main.js — workspace packages are inlined.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/geoprivacy/package.json packages/geoprivacy/
COPY packages/scoring/package.json packages/scoring/
RUN pnpm install --frozen-lockfile --filter api...

FROM deps AS build
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY packages/geoprivacy packages/geoprivacy
COPY packages/scoring packages/scoring
COPY packages/db packages/db
COPY apps/api apps/api
# scoring depends on geoprivacy; api forecast/weather import @wildwindow/scoring
RUN pnpm --filter @wildwindow/geoprivacy build \
  && pnpm --filter @wildwindow/scoring build \
  && pnpm --filter @wildwindow/shared build \
  && pnpm --filter @wildwindow/db build \
  && pnpm --filter api build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 ww \
  && useradd --system --uid 1001 --gid ww ww
# Bundled dist inlines @wildwindow/* only (skipNodeModulesBundle). npm deps
# (express, yaml, pg, …) must resolve from node_modules at runtime.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/package.json ./package.json
USER ww
WORKDIR /app/apps/api
EXPOSE 3001
# Railway sets PORT; local default matches ARCHITECTURE.
CMD ["node", "dist/main.js"]
