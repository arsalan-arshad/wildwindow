# Multi-stage Next.js web image (non-root). Build context = monorepo root.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
# shared analytics/sentry-scrub (T9.1) import @wildwindow/geoprivacy
COPY packages/geoprivacy/package.json packages/geoprivacy/
RUN pnpm install --frozen-lockfile --filter web...

FROM deps AS build
COPY packages/config packages/config
COPY packages/geoprivacy packages/geoprivacy
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @wildwindow/geoprivacy build \
  && pnpm --filter @wildwindow/shared build
# Next standalone needs the app directory as cwd for correct tracing.
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* are inlined at `next build`. Railway Variables are ENV during
# build; ARG also lets `docker build --build-arg` inject them locally.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_FIREBASE_CONFIG
ENV NEXT_PUBLIC_FIREBASE_CONFIG=$NEXT_PUBLIC_FIREBASE_CONFIG
RUN pnpm --filter web build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Railway sets HOSTNAME to the container hostname; Next binds to it and the
# healthcheck fails. Force all-interfaces like a normal container listen.
ENV HOSTNAME=0.0.0.0
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
