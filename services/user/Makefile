.PHONY: load-test-build load-test load-test-cold load-test-stop load-test-clean \
        load-test-auth load-test-signup

COMPOSE := docker compose -f load-tests/compose.loadtest.yml --project-name topos-user-loadtest

RPS             ?= 50
VUS             ?= 20
DURATION        ?= 30s
SCRIPT          ?= mixed
SEED_USER_COUNT ?= 5000
WEIGHTS         ?= reads:50,user:20,me:10,signin:10,signup:10
USER_JWT_SECRET ?= local-loadtest-secret

PG_MEM    ?= 1G
REDIS_MEM ?= 512mb
SVC_MEM   ?= 768M
K6_MEM    ?= 384M

load-test-build:
	$(COMPOSE) build

load-test:
	@if [ "$(SCRIPT)" = "mixed" ] || [ "$(SCRIPT)" = "users-list" ] || [ "$(SCRIPT)" = "user-by-id" ] || [ "$(SCRIPT)" = "me" ] || [ "$(SCRIPT)" = "signup" ] || [ "$(SCRIPT)" = "signin" ] || [ "$(SCRIPT)" = "signin-then-me" ]; then :; else \
		echo "unknown SCRIPT=$(SCRIPT). valid: mixed users-list user-by-id me signup signin signin-then-me"; exit 2; \
	fi
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_USER_COUNT=$(SEED_USER_COUNT) WEIGHTS=$(WEIGHTS) \
	USER_JWT_SECRET=$(USER_JWT_SECRET) \
	PG_MEM=$(PG_MEM) REDIS_MEM=$(REDIS_MEM) SVC_MEM=$(SVC_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) up --abort-on-container-exit --exit-code-from k6
	@EXIT=$$?; \
	$(MAKE) --no-print-directory load-test-stop; \
	exit $$EXIT

load-test-cold: load-test-build
	@if [ "$(SCRIPT)" = "mixed" ] || [ "$(SCRIPT)" = "users-list" ] || [ "$(SCRIPT)" = "user-by-id" ] || [ "$(SCRIPT)" = "me" ] || [ "$(SCRIPT)" = "signup" ] || [ "$(SCRIPT)" = "signin" ] || [ "$(SCRIPT)" = "signin-then-me" ]; then :; else \
		echo "unknown SCRIPT=$(SCRIPT). valid: mixed users-list user-by-id me signup signin signin-then-me"; exit 2; \
	fi
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_USER_COUNT=$(SEED_USER_COUNT) WEIGHTS=$(WEIGHTS) \
	USER_JWT_SECRET=$(USER_JWT_SECRET) \
	PG_MEM=$(PG_MEM) REDIS_MEM=$(REDIS_MEM) SVC_MEM=$(SVC_MEM) K6_MEM=$(K6_MEM) \
	$(COMPOSE) up -d --wait user-postgres user-redis user-migrate user-seed user-service
	@echo "[cold] flushing redis"
	$(COMPOSE) exec -T user-redis redis-cli FLUSHALL
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_USER_COUNT=$(SEED_USER_COUNT) WEIGHTS=$(WEIGHTS) \
	USER_JWT_SECRET=$(USER_JWT_SECRET) \
	$(COMPOSE) run --rm k6
	@EXIT=$$?; \
	$(MAKE) --no-print-directory load-test-stop; \
	exit $$EXIT

load-test-auth: SCRIPT = signin-then-me
load-test-auth: load-test

load-test-signup: SCRIPT = signup
load-test-signup: load-test

load-test-stop:
	SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	SEED_USER_COUNT=$(SEED_USER_COUNT) WEIGHTS=$(WEIGHTS) \
	USER_JWT_SECRET=$(USER_JWT_SECRET) \
	$(COMPOSE) down -v --remove-orphans

load-test-clean: load-test-stop

load-test-tail:
	$(COMPOSE) logs -f
