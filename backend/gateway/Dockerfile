FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json tsconfig.base.json .eslintrc.json ./
COPY shared ./shared
COPY gateway ./gateway

RUN npm install
RUN npm run build --workspace=shared
RUN npm run build --workspace=gateway

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/gateway ./gateway

EXPOSE 8000
CMD ["node", "gateway/dist/index.js"]
