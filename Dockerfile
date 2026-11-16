# syntax=docker/dockerfile:1.6

# ---- Deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# BuildKit cache mount: npm 다운로드 캐시가 빌드 간 유지되어 재빌드가 훨씬 빠름
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --prefer-offline --no-audit --no-fund --omit=dev=false

# ---- Build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js 의 SWC/Webpack 캐시도 빌드 간 유지
RUN --mount=type=cache,target=/app/.next/cache,sharing=locked \
    npm run build

# ---- Runtime ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Fly volume mount point — persistent data (rooms·auth·activity·uploaded files)
ENV POLYMATH_DATA_DIR=/data

# non-root 사용자
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Next.js standalone 번들만 복사 (약 100MB 수준)
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# 데이터 디렉토리 — Fly volume 가 없을 때도 fallback
RUN mkdir -p /data && chown -R nextjs:nodejs /data
VOLUME ["/data"]

USER nextjs
EXPOSE 3000

# Next standalone 의 server.js 사용
CMD ["node", "server.js"]
