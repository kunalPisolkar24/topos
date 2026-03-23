FROM node:20-bookworm-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS build

COPY package*.json ./

RUN npm ci

COPY . .

RUN DATABASE_URL_MIGRATE="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate \
    && npm run build

FROM build AS migrator

CMD ["npm", "run", "prisma:migrate:deploy"]

FROM base AS runtime

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN npm prune --omit=dev \
    && npm cache clean --force

ENV NODE_ENV=production

EXPOSE 4001

CMD ["npm", "start"]
