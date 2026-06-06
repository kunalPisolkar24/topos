# syntax=docker/dockerfile:1.4
FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

FROM builder AS build-server
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/content-service cmd/server/main.go

FROM builder AS build-worker
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/content-worker cmd/worker/main.go

FROM alpine:3.20 AS runtime-base

WORKDIR /app

RUN addgroup -g 1000 appuser && adduser -u 1000 -G appuser -D appuser
RUN apk add --no-cache ca-certificates wget

FROM runtime-base AS content-service
COPY --from=build-server /out/content-service /app/content-service
USER appuser
EXPOSE 4002
CMD ["./content-service"]

FROM runtime-base AS content-worker
COPY --from=build-worker /out/content-worker /app/content-worker
USER appuser
CMD ["./content-worker"]
