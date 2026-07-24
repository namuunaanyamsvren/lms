FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json tsconfig.base.json .eslintrc.json ./
COPY shared ./shared
COPY billing-service ./billing-service

RUN npm install
RUN npx prisma generate --schema=./billing-service/src/prisma/schema.prisma
RUN npm run build --workspace=shared
RUN npm run build --workspace=billing-service

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/billing-service ./billing-service

EXPOSE 8004
CMD ["node", "billing-service/dist/index.js"]
