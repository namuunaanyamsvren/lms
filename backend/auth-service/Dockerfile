FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json tsconfig.base.json .eslintrc.json ./
COPY shared ./shared
COPY auth-service ./auth-service

RUN npm install
RUN npx prisma generate --schema=./auth-service/src/prisma/schema.prisma
RUN npm run build --workspace=shared
RUN npm run build --workspace=auth-service

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/auth-service ./auth-service

EXPOSE 8001
CMD ["node", "auth-service/dist/index.js"]
