FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund

COPY . .
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_TENANT_BASE_DOMAIN=localhost
ARG VITE_ENABLE_DEMO_LOGIN=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_TENANT_BASE_DOMAIN=$VITE_TENANT_BASE_DOMAIN
ENV VITE_ENABLE_DEMO_LOGIN=$VITE_ENABLE_DEMO_LOGIN
RUN npm run build

FROM nginx:1.27-alpine AS runner
RUN apk add --no-cache curl
ENV API_UPSTREAM=http://gateway:8000
ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health >/dev/null || exit 1
