BINARY_NAME=content-service
COVERAGE_FILE=coverage.out

.PHONY: install run generate test test-cover test-html test-integration test-all build clean \
        load-test-build load-test load-test-cold load-test-stop load-test-clean load-test-tail \
        load-test-posts-list load-test-post-by-id load-test-tags-list load-test-posts-by-tag \
        load-test-create-post load-test-create-verify

install:
	go mod download
	go mod tidy

run:
	go run cmd/server/main.go

generate:
	go run github.com/99designs/gqlgen generate

test:
	go test -v ./...

test-cover:
	go test -cover ./...

test-html:
	go test -coverprofile=$(COVERAGE_FILE) ./...
	go tool cover -html=$(COVERAGE_FILE)
	rm -f $(COVERAGE_FILE)

test-integration:
	go test -tags=integration -v -count=1 ./internal/repository/... ./internal/service/...

test-all: test test-integration

build:
	CGO_ENABLED=0 GOOS=linux go build -o $(BINARY_NAME) cmd/server/main.go

clean:
	go clean
	rm -f $(BINARY_NAME)
	rm -f $(COVERAGE_FILE)

# --- Load Test Targets ---

COMPOSE := docker compose -f load-tests/compose.loadtest.yml --project-name topos-content-loadtest

RPS               ?= 50
VUS               ?= 20
DURATION          ?= 30s
SCRIPT            ?= mixed
SEED_POST_COUNT   ?= 5000
WEIGHTS           ?= reads:50,post:20,tag:10,bytag:10,create:10
CONTENT_JWT_SECRET ?= local-loadtest-secret

MONGO_MEM   ?= 1G
REDIS_MEM   ?= 512mb
KAFKA_MEM   ?= 768M
SVC_MEM     ?= 768M
WORKER_MEM  ?= 512M
K6_MEM      ?= 384M

load-test-build:
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	CONTENT_JWT_SECRET=$(CONTENT_JWT_SECRET) \
	MONGO_MEM=$(MONGO_MEM) REDIS_MEM=$(REDIS_MEM) KAFKA_MEM=$(KAFKA_MEM) \
	SVC_MEM=$(SVC_MEM) WORKER_MEM=$(WORKER_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) build

load-test: load-test-build
	@if [ "$(SCRIPT)" = "mixed" ] || [ "$(SCRIPT)" = "posts-list" ] || [ "$(SCRIPT)" = "post-by-id" ] || [ "$(SCRIPT)" = "tags-list" ] || [ "$(SCRIPT)" = "posts-by-tag" ] || [ "$(SCRIPT)" = "create-post" ] || [ "$(SCRIPT)" = "create-and-verify" ]; then :; else \
		echo "unknown SCRIPT=$(SCRIPT). valid: mixed posts-list post-by-id tags-list posts-by-tag create-post create-and-verify"; exit 2; \
	fi
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	CONTENT_JWT_SECRET=$(CONTENT_JWT_SECRET) \
	MONGO_MEM=$(MONGO_MEM) REDIS_MEM=$(REDIS_MEM) KAFKA_MEM=$(KAFKA_MEM) \
	SVC_MEM=$(SVC_MEM) WORKER_MEM=$(WORKER_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) up -d --wait content-mongo content-redis content-kafka content-init-kafka content-seed content-service content-worker
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	CONTENT_JWT_SECRET=$(CONTENT_JWT_SECRET) \
	$(COMPOSE) run --rm k6
	@EXIT=$$?; \
	$(MAKE) --no-print-directory load-test-stop; \
	exit $$EXIT

load-test-cold: load-test-build
	@if [ "$(SCRIPT)" = "mixed" ] || [ "$(SCRIPT)" = "posts-list" ] || [ "$(SCRIPT)" = "post-by-id" ] || [ "$(SCRIPT)" = "tags-list" ] || [ "$(SCRIPT)" = "posts-by-tag" ] || [ "$(SCRIPT)" = "create-post" ] || [ "$(SCRIPT)" = "create-and-verify" ]; then :; else \
		echo "unknown SCRIPT=$(SCRIPT). valid: mixed posts-list post-by-id tags-list posts-by-tag create-post create-and-verify"; exit 2; \
	fi
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	CONTENT_JWT_SECRET=$(CONTENT_JWT_SECRET) \
	MONGO_MEM=$(MONGO_MEM) REDIS_MEM=$(REDIS_MEM) KAFKA_MEM=$(KAFKA_MEM) \
	SVC_MEM=$(SVC_MEM) WORKER_MEM=$(WORKER_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) up -d --wait content-mongo content-redis content-kafka content-init-kafka content-seed content-service content-worker
	@echo "[cold] flushing redis"
	$(COMPOSE) exec -T content-redis redis-cli FLUSHALL
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	CONTENT_JWT_SECRET=$(CONTENT_JWT_SECRET) \
	$(COMPOSE) run --rm k6
	@EXIT=$$?; \
	$(MAKE) --no-print-directory load-test-stop; \
	exit $$EXIT

load-test-posts-list: SCRIPT = posts-list
load-test-posts-list: load-test

load-test-post-by-id: SCRIPT = post-by-id
load-test-post-by-id: load-test

load-test-tags-list: SCRIPT = tags-list
load-test-tags-list: load-test

load-test-posts-by-tag: SCRIPT = posts-by-tag
load-test-posts-by-tag: load-test

load-test-create-post: SCRIPT = create-post
load-test-create-post: load-test

load-test-create-verify: SCRIPT = create-and-verify
load-test-create-verify: load-test

load-test-stop:
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	CONTENT_JWT_SECRET=$(CONTENT_JWT_SECRET) \
	MONGO_MEM=$(MONGO_MEM) REDIS_MEM=$(REDIS_MEM) KAFKA_MEM=$(KAFKA_MEM) \
	SVC_MEM=$(SVC_MEM) WORKER_MEM=$(WORKER_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) down -v --remove-orphans

load-test-clean: load-test-stop

load-test-tail:
	$(COMPOSE) logs -f