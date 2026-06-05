# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20.20.2

FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:${NODE_VERSION}-alpine AS prod-deps
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

FROM node:${NODE_VERSION}-alpine AS runtime
ARG GIT_REVISION=unknown
LABEL org.opencontainers.image.title="blogapp-search" \
      org.opencontainers.image.source="https://github.com/kunalPisolkar24/topos" \
      org.opencontainers.image.revision="${GIT_REVISION}" \
      org.opencontainers.image.licenses="MIT"

RUN apk add --no-cache tini curl \
    && rm -rf /usr/local/lib/node_modules/npm/man /usr/local/share/man/*

WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=prod-deps --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=builder   --chown=node:node /usr/src/app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 4003 7091

ENTRYPOINT ["/sbin/tini", "--"]
