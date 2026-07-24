FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json tsconfig.base.json .eslintrc.json ./
COPY shared ./shared
COPY organization-service ./organization-service

RUN npm install
RUN npx prisma generate --schema=./organization-service/src/prisma/schema.prisma
RUN npm run build --workspace=shared
RUN npm run build --workspace=organization-service

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/organization-service ./organization-service

EXPOSE 8002
CMD ["node", "organization-service/dist/index.js"]
