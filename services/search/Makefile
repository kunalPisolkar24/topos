.PHONY: load-test-build load-test load-test-cold load-test-stop load-test-clean \
        load-test-tail
.PHONY: load-test-worker-build load-test-worker load-test-worker-stop \
        load-test-worker-clean load-test-worker-tail

COMPOSE := docker compose -f load-tests/compose.loadtest.yml --project-name topos-search-loadtest
WORKER_COMPOSE := docker compose -f load-tests/compose.worker.loadtest.yml --project-name topos-search-worker-loadtest

RPS             ?= 50
VUS             ?= 20
DURATION        ?= 30s
SCRIPT          ?= search
SEED_POST_COUNT ?= 5000
WEIGHTS         ?= shortQuery:50,phraseQuery:25,paginatedQuery:15,targetedQuery:10

ES_HEAP   ?= 512m
ES_MEM    ?= 1G
REDIS_MEM ?= 256mb
SVC_MEM   ?= 512M
K6_MEM    ?= 384M

LOADGEN_RPS          ?= 100
LOADGEN_DURATION     ?= 30
LOADGEN_MESSAGE_SIZE ?= medium
LOADGEN_PARTITIONS   ?= 3
KAFKA_MEM            ?= 1G

load-test-build:
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) REDIS_MEM=$(REDIS_MEM) SVC_MEM=$(SVC_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) build

load-test: load-test-build
	@if [ "$(SCRIPT)" = "search" ] || [ "$(SCRIPT)" = "mixed" ]; then :; else \
		echo "unknown SCRIPT=$(SCRIPT). valid: search mixed"; exit 2; \
	fi
	mkdir -p load-tests/k6/seed_data
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) REDIS_MEM=$(REDIS_MEM) SVC_MEM=$(SVC_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) up -d --wait search-es search-redis
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) REDIS_MEM=$(REDIS_MEM) SVC_MEM=$(SVC_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) up --abort-on-container-exit search-seed
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) REDIS_MEM=$(REDIS_MEM) SVC_MEM=$(SVC_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) up -d --wait search-api
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) REDIS_MEM=$(REDIS_MEM) SVC_MEM=$(SVC_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) run --rm k6
	@EXIT=$$?; \
	$(MAKE) --no-print-directory load-test-stop; \
	exit $$EXIT

load-test-cold: load-test-build
	@if [ "$(SCRIPT)" = "search" ] || [ "$(SCRIPT)" = "mixed" ]; then :; else \
		echo "unknown SCRIPT=$(SCRIPT). valid: search mixed"; exit 2; \
	fi
	mkdir -p load-tests/k6/seed_data
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) REDIS_MEM=$(REDIS_MEM) SVC_MEM=$(SVC_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) up -d --wait search-es search-redis
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) REDIS_MEM=$(REDIS_MEM) SVC_MEM=$(SVC_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) up --abort-on-container-exit search-seed
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) REDIS_MEM=$(REDIS_MEM) SVC_MEM=$(SVC_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) up -d --wait search-api
	@echo "[cold] flushing redis cache before load test"
	$(COMPOSE) exec -T search-redis redis-cli FLUSHALL
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) REDIS_MEM=$(REDIS_MEM) SVC_MEM=$(SVC_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) run --rm k6
	@EXIT=$$?; \
	$(MAKE) --no-print-directory load-test-stop; \
	exit $$EXIT

load-test-stop:
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_POST_COUNT=$(SEED_POST_COUNT) WEIGHTS=$(WEIGHTS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) REDIS_MEM=$(REDIS_MEM) SVC_MEM=$(SVC_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) down -v --remove-orphans

load-test-clean: load-test-stop
	rm -rf load-tests/k6/seed_data

load-test-tail:
	$(COMPOSE) logs -f

load-test-worker-build:
	LOADGEN_RPS=$(LOADGEN_RPS) LOADGEN_DURATION=$(LOADGEN_DURATION) \
	LOADGEN_MESSAGE_SIZE=$(LOADGEN_MESSAGE_SIZE) LOADGEN_PARTITIONS=$(LOADGEN_PARTITIONS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) KAFKA_MEM=$(KAFKA_MEM) SVC_MEM=$(SVC_MEM) \
	$(WORKER_COMPOSE) build

load-test-worker: load-test-worker-build
	mkdir -p load-tests/k6/seed_data
	LOADGEN_RPS=$(LOADGEN_RPS) LOADGEN_DURATION=$(LOADGEN_DURATION) \
	LOADGEN_MESSAGE_SIZE=$(LOADGEN_MESSAGE_SIZE) LOADGEN_PARTITIONS=$(LOADGEN_PARTITIONS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) KAFKA_MEM=$(KAFKA_MEM) SVC_MEM=$(SVC_MEM) \
	$(WORKER_COMPOSE) up -d --wait kafka search-es
	LOADGEN_RPS=$(LOADGEN_RPS) LOADGEN_DURATION=$(LOADGEN_DURATION) \
	LOADGEN_MESSAGE_SIZE=$(LOADGEN_MESSAGE_SIZE) LOADGEN_PARTITIONS=$(LOADGEN_PARTITIONS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) KAFKA_MEM=$(KAFKA_MEM) SVC_MEM=$(SVC_MEM) \
	$(WORKER_COMPOSE) up -d --wait search-worker
	LOADGEN_RPS=$(LOADGEN_RPS) LOADGEN_DURATION=$(LOADGEN_DURATION) \
	LOADGEN_MESSAGE_SIZE=$(LOADGEN_MESSAGE_SIZE) LOADGEN_PARTITIONS=$(LOADGEN_PARTITIONS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) KAFKA_MEM=$(KAFKA_MEM) SVC_MEM=$(SVC_MEM) \
	$(WORKER_COMPOSE) up --abort-on-container-exit loadgen
	@EXIT=$$?; \
	$(MAKE) --no-print-directory load-test-worker-stop; \
	exit $$EXIT

load-test-worker-stop:
	LOADGEN_RPS=$(LOADGEN_RPS) LOADGEN_DURATION=$(LOADGEN_DURATION) \
	LOADGEN_MESSAGE_SIZE=$(LOADGEN_MESSAGE_SIZE) LOADGEN_PARTITIONS=$(LOADGEN_PARTITIONS) \
	ES_HEAP=$(ES_HEAP) ES_MEM=$(ES_MEM) KAFKA_MEM=$(KAFKA_MEM) SVC_MEM=$(SVC_MEM) \
	$(WORKER_COMPOSE) down -v --remove-orphans

load-test-worker-clean: load-test-worker-stop
	rm -rf load-tests/k6/seed_data

load-test-worker-tail:
	$(WORKER_COMPOSE) logs -f
