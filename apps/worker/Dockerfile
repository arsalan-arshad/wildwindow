# Multi-stage worker CLI image (non-root). Build context = monorepo root.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/geoprivacy/package.json packages/geoprivacy/
COPY packages/scoring/package.json packages/scoring/
RUN pnpm install --frozen-lockfile --filter worker...

FROM deps AS build
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY packages/geoprivacy packages/geoprivacy
COPY packages/scoring packages/scoring
COPY packages/db packages/db
COPY apps/worker apps/worker
RUN pnpm --filter @wildwindow/geoprivacy build \
  && pnpm --filter @wildwindow/scoring build \
  && pnpm --filter @wildwindow/shared build \
  && pnpm --filter @wildwindow/db build \
  && pnpm --filter worker build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 ww \
  && useradd --system --uid 1001 --gid ww ww
# Hoisted linker: third-party deps live in root node_modules; workspace
# packages (@wildwindow/*) are linked from apps/worker/node_modules.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/geoprivacy/dist ./packages/geoprivacy/dist
COPY --from=build /app/packages/geoprivacy/package.json ./packages/geoprivacy/package.json
COPY --from=build /app/packages/scoring/dist ./packages/scoring/dist
COPY --from=build /app/packages/scoring/package.json ./packages/scoring/package.json
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/db/package.json ./packages/db/package.json
COPY --from=build /app/packages/db/migrations ./packages/db/migrations
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=build /app/package.json ./package.json
# beta-species.yaml (and friends) for gbif:request defaults (paths.ts → /app/data).
COPY data ./data
USER ww
WORKDIR /app/apps/worker
# Default smoke command; override on Railway for one-off jobs / cron.
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["hello"]
