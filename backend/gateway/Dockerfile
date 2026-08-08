FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json ./shared/package.json
COPY gateway/package.json ./gateway/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=shared --workspace=gateway \
    --include-workspace-root=false --prefer-offline --no-audit --no-fund

COPY shared ./shared
COPY gateway ./gateway

RUN npm run build --workspace=shared
RUN npm run build --workspace=gateway
RUN npm prune --omit=dev --workspace=shared --workspace=gateway \
    --include-workspace-root=false --no-audit --no-fund

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/shared ./shared
COPY --from=builder --chown=node:node /app/gateway ./gateway

EXPOSE 8000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "gateway/dist/index.js"]
