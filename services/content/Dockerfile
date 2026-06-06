# syntax=docker/dockerfile:1.4
FROM golang:1.25 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

FROM builder AS build-server
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/content-service cmd/server/main.go

FROM builder AS build-worker
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/content-worker cmd/worker/main.go

FROM debian:bullseye-slim AS runtime-base

WORKDIR /app

RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*

FROM runtime-base AS content-service
COPY --from=build-server /out/content-service /app/content-service
USER appuser
EXPOSE 4002
CMD ["./content-service"]

FROM runtime-base AS content-worker
COPY --from=build-worker /out/content-worker /app/content-worker
USER appuser
CMD ["./content-worker"]
