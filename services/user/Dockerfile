FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm ci \
    && DATABASE_URL_MIGRATE="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate \
    && npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force

ENV NODE_ENV=production

EXPOSE 4001

CMD ["npm", "start"]
