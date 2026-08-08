FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json ./shared/package.json
COPY notification-service/package.json ./notification-service/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=shared --workspace=notification-service \
    --include-workspace-root=false --prefer-offline --no-audit --no-fund

COPY shared ./shared
COPY notification-service ./notification-service

RUN ./node_modules/.bin/prisma generate --schema=./notification-service/src/prisma/schema.prisma
RUN npm run build --workspace=shared
RUN npm run build --workspace=notification-service
RUN npm prune --omit=dev --workspace=shared --workspace=notification-service \
    --include-workspace-root=false --no-audit --no-fund

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/shared ./shared
COPY --from=builder --chown=node:node /app/notification-service ./notification-service

EXPOSE 8005
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8005/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --schema=notification-service/src/prisma/schema.prisma && node notification-service/dist/index.js"]
