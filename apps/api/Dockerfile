# Multi-stage NestJS API image (non-root).
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile --filter api...

FROM deps AS build
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @wildwindow/shared build && pnpm --filter api build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 ww \
  && useradd --system --uid 1001 --gid ww ww
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./package.json
USER ww
EXPOSE 3001
CMD ["node", "dist/main.js"]
