FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json ./shared/package.json
COPY gateway/package.json ./gateway/package.json
COPY auth-service/package.json ./auth-service/package.json
COPY organization-service/package.json ./organization-service/package.json
COPY academic-service/package.json ./academic-service/package.json
COPY billing-service/package.json ./billing-service/package.json
COPY notification-service/package.json ./notification-service/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm ci \
      --workspace=shared \
      --workspace=gateway \
      --workspace=auth-service \
      --workspace=organization-service \
      --workspace=academic-service \
      --workspace=billing-service \
      --workspace=notification-service \
      --include-workspace-root=false --prefer-offline --no-audit --no-fund

COPY shared ./shared
COPY gateway ./gateway
COPY auth-service ./auth-service
COPY organization-service ./organization-service
COPY academic-service ./academic-service
COPY billing-service ./billing-service
COPY notification-service ./notification-service
COPY scripts ./scripts

RUN ./node_modules/.bin/prisma generate --schema=./auth-service/src/prisma/schema.prisma
RUN ./node_modules/.bin/prisma generate --schema=./organization-service/src/prisma/schema.prisma
RUN ./node_modules/.bin/prisma generate --schema=./academic-service/src/prisma/schema.prisma
RUN ./node_modules/.bin/prisma generate --schema=./billing-service/src/prisma/schema.prisma
RUN ./node_modules/.bin/prisma generate --schema=./notification-service/src/prisma/schema.prisma

RUN npm run build --workspace=shared
RUN npm run build --workspace=gateway
RUN npm run build --workspace=auth-service
RUN npm run build --workspace=organization-service
RUN npm run build --workspace=academic-service
RUN npm run build --workspace=billing-service
RUN npm run build --workspace=notification-service

RUN npm prune --omit=dev \
      --workspace=shared \
      --workspace=gateway \
      --workspace=auth-service \
      --workspace=organization-service \
      --workspace=academic-service \
      --workspace=billing-service \
      --workspace=notification-service \
      --include-workspace-root=false --no-audit --no-fund

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=staging
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

RUN mkdir -p /data/private-uploads && chown -R node:node /data
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/shared ./shared
COPY --from=builder --chown=node:node /app/gateway ./gateway
COPY --from=builder --chown=node:node /app/auth-service ./auth-service
COPY --from=builder --chown=node:node /app/organization-service ./organization-service
COPY --from=builder --chown=node:node /app/academic-service ./academic-service
COPY --from=builder --chown=node:node /app/billing-service ./billing-service
COPY --from=builder --chown=node:node /app/notification-service ./notification-service
COPY --from=builder --chown=node:node /app/scripts/start-single-render.js ./scripts/start-single-render.js

EXPOSE 8000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8000) + '/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/start-single-render.js"]
