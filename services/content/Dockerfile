FROM golang:1.25 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o content-service cmd/server/main.go
RUN CGO_ENABLED=0 GOOS=linux go build -o content-worker cmd/worker/main.go

FROM debian:bullseye-slim

WORKDIR /app

RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/content-service .
COPY --from=builder /app/content-worker .

USER appuser

EXPOSE 4002

CMD ["./content-service"]