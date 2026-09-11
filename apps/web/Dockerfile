# PaxPivot web image (Next standalone). Build from the repository root:
#   docker build -f apps/web/Dockerfile .
FROM node:24.15.0-slim AS build
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
WORKDIR /srv
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

FROM node:24.15.0-slim
RUN useradd --system --uid 10001 paxpivot
WORKDIR /srv
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /srv/apps/web/.next/standalone ./
COPY --from=build /srv/apps/web/.next/static ./apps/web/.next/static
USER paxpivot
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
