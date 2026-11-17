FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile --filter worker...

FROM deps AS build
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/worker apps/worker
RUN pnpm --filter @wildwindow/shared build && pnpm --filter worker build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 ww \
  && useradd --system --uid 1001 --gid ww ww
COPY --from=build /app/apps/worker/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/package.json ./package.json
USER ww
ENTRYPOINT ["node", "dist/cli.js"]
