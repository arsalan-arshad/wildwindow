# Multi-stage Next.js web image (non-root). Build context = monorepo root.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile --filter web...

FROM deps AS build
COPY packages/config packages/config
COPY apps/web apps/web
# Next standalone needs the app directory as cwd for correct tracing.
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN groupadd --system --gid 1001 ww \
  && useradd --system --uid 1001 --gid ww ww
# standalone output includes server.js + minimal node_modules.
# With outputFileTracingRoot = monorepo root, standalone also copies the
# root package.json (type:module). server.js is CommonJS `require`.
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
# Pin CJS next to server.js so Node does not inherit root type:module.
RUN printf '%s\n' '{"type":"commonjs"}' > ./apps/web/package.json
USER ww
WORKDIR /app/apps/web
EXPOSE 3000
# Railway sets PORT; Next reads it. Healthcheck path is `/`.
CMD ["node", "server.js"]
