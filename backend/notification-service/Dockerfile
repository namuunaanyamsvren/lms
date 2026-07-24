FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json tsconfig.base.json .eslintrc.json ./
COPY shared ./shared
COPY notification-service ./notification-service

RUN npm install
RUN npx prisma generate --schema=./notification-service/src/prisma/schema.prisma
RUN npm run build --workspace=shared
RUN npm run build --workspace=notification-service

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/notification-service ./notification-service

EXPOSE 8005
CMD ["node", "notification-service/dist/index.js"]
