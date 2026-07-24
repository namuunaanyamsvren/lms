FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json tsconfig.base.json .eslintrc.json ./
COPY shared ./shared
COPY academic-service ./academic-service

RUN npm install
RUN npx prisma generate --schema=./academic-service/src/prisma/schema.prisma
RUN npm run build --workspace=shared
RUN npm run build --workspace=academic-service

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/academic-service ./academic-service

EXPOSE 8003
CMD ["node", "academic-service/dist/index.js"]
