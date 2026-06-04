FROM node:20-bookworm-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps

COPY package*.json ./

RUN npm ci --include=dev --no-audit --no-fund

FROM deps AS build

COPY . .

RUN DATABASE_URL_MIGRATE="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate \
    && npm run build

FROM base AS migrator

COPY package.migrator.json ./package.json

RUN npm install --omit=optional --no-audit --no-fund \
    && rm -rf /app/node_modules/@electric-sql \
              /app/node_modules/mysql2 \
              /app/node_modules/postgres \
              /app/node_modules/@prisma/studio-core/dist/ui \
              /app/node_modules/@prisma/studio-core/dist/metafile-cjs.json \
              /app/node_modules/@prisma/studio-core/dist/metafile-esm.json \
    && npm cache clean --force

COPY prisma.config.ts ./prisma.config.ts
COPY prisma ./prisma

CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM base AS runtime

COPY package*.json ./

RUN npm ci --omit=dev --no-audit --no-fund \
    && find /app/node_modules/@prisma/client/runtime \
        \( -name 'query_compiler_*.mysql.*' \
        -o -name 'query_compiler_*.sqlite.*' \
        -o -name 'query_compiler_*.cockroachdb.*' \
        -o -name 'query_compiler_*.sqlserver.*' \) -delete \
    && rm -rf /app/node_modules/@prisma/engines \
    && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated/prisma ./src/generated/prisma

ENV NODE_ENV=production

EXPOSE 4001

CMD ["npm", "start"]
