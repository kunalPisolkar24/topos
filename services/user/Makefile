.PHONY: install build dev start db-generate db-migrate db-deploy \
        image image-migrator run \
        load-test-build load-test load-test-signup load-test-signin \
        load-test-me load-test-users load-test-update-profile \
        load-test-cold load-test-stop load-test-clean load-test-tail \
        up down logs clean

NODE_VERSION ?= 22.14.0
IMAGE       ?= topos-user
TAG         ?= latest

install:
	npm ci

build:
	npm run build

dev:
	npm run dev

start:
	npm start

db-generate:
	npx prisma generate

db-migrate:
	npx prisma migrate dev

db-deploy:
	npx prisma migrate deploy

image:
	docker build --build-arg NODE_VERSION=$(NODE_VERSION) -t $(IMAGE):$(TAG) .

image-migrator:
	docker build --target migrator --build-arg NODE_VERSION=$(NODE_VERSION) -t $(IMAGE)-migrator:$(TAG) .

run:
	docker run --rm -p 4001:4001 --env-file .env $(IMAGE):$(TAG)

# --- Load Tests ---

COMPOSE_LT := docker compose -f infra/compose.loadtest.yml --project-name topos-user-loadtest

RPS             ?= 50
VUS             ?= 20
DURATION        ?= 30s
SCRIPT          ?= mixed
WEIGHTS         ?= users:30,user:15,me:20,signin:20,updateProfile:10,signup:5
SEED_USERS      ?= 100
USER_JWT_SECRET ?= loadtest-jwt-secret-0123456789abcdef

PG_MEM    ?= 512M
REDIS_MEM ?= 256M
SVC_MEM   ?= 512M
K6_MEM    ?= 384M

LT_VARS := SCRIPT=$(SCRIPT) RPS=$(RPS) VUS=$(VUS) DURATION=$(DURATION) \
	WEIGHTS=$(WEIGHTS) SEED_USERS=$(SEED_USERS) USER_JWT_SECRET=$(USER_JWT_SECRET) \
	PG_MEM=$(PG_MEM) REDIS_MEM=$(REDIS_MEM) SVC_MEM=$(SVC_MEM) K6_MEM=$(K6_MEM) \
	USER_POSTGRES_CONTAINER=loadtest-user-postgres USER_REDIS_CONTAINER=loadtest-user-redis \
	USER_POSTGRES_EXT_PORT=5434 USER_REDIS_EXT_PORT=6381 \
	USER_POSTGRES_MEM=$(PG_MEM) USER_REDIS_MEM=$(REDIS_MEM) \
	USER_REDIS_APPENDONLY=no USER_REDIS_SAVE=

VALID_SCRIPTS := mixed signup signin me users update-profile

load-test-build:
	$(LT_VARS) $(COMPOSE_LT) build

load-test: load-test-build
	@if echo " $(VALID_SCRIPTS) " | grep -q " $(SCRIPT) "; then :; else \
		echo "unknown SCRIPT=$(SCRIPT). valid: $(VALID_SCRIPTS)"; exit 2; \
	fi
	$(LT_VARS) $(COMPOSE_LT) up -d --wait user-service
	$(LT_VARS) $(COMPOSE_LT) run --rm k6
	@EXIT=$$?; \
	$(MAKE) --no-print-directory load-test-stop; \
	exit $$EXIT

load-test-cold: load-test-build
	@if echo " $(VALID_SCRIPTS) " | grep -q " $(SCRIPT) "; then :; else \
		echo "unknown SCRIPT=$(SCRIPT). valid: $(VALID_SCRIPTS)"; exit 2; \
	fi
	$(LT_VARS) $(COMPOSE_LT) up -d --wait user-service
	@echo "[cold] flushing redis cache"
	$(LT_VARS) $(COMPOSE_LT) exec -T user-redis redis-cli FLUSHALL
	$(LT_VARS) $(COMPOSE_LT) run --rm k6
	@EXIT=$$?; \
	$(MAKE) --no-print-directory load-test-stop; \
	exit $$EXIT

load-test-signup: SCRIPT = signup
load-test-signup: load-test

load-test-signin: SCRIPT = signin
load-test-signin: load-test

load-test-me: SCRIPT = me
load-test-me: load-test

load-test-users: SCRIPT = users
load-test-users: load-test

load-test-update-profile: SCRIPT = update-profile
load-test-update-profile: load-test

load-test-stop:
	$(LT_VARS) $(COMPOSE_LT) down -v --remove-orphans

load-test-clean: load-test-stop

load-test-tail:
	$(COMPOSE_LT) logs -f

# --- Standalone Stack (single Postgres + Redis + service) ---

COMPOSE := docker compose -f infra/compose.yml --project-name topos-user-local

# Optional deps — caps canonical, lowercase alias. Keep Redis URL pointing at the
# stopped host when disabled so reconnect is tested (empty USER_REDIS_URL disables
# the client entirely). Postgres disabled leaves DATABASE_URL pointing at the
# stopped host (GraphQL -> SERVICE_UNAVAILABLE, /ready 503); override with
# USER_DATABASE_URL for an external DB.
WITH_POSTGRES ?= 1
WITH_REDIS ?= 1
with_postgres ?= $(WITH_POSTGRES)
with_redis ?= $(WITH_REDIS)
WITH_POSTGRES := $(if $(filter 0,$(WITH_POSTGRES) $(with_postgres)),0,1)
WITH_REDIS := $(if $(filter 0,$(WITH_REDIS) $(with_redis)),0,1)

up:
	@if [ "$(WITH_POSTGRES)" = "1" ] && [ "$(WITH_REDIS)" = "1" ]; then \
		echo "up: with postgres and redis"; \
		$(COMPOSE) up -d --build --wait user-service; \
	elif [ "$(WITH_POSTGRES)" = "1" ] && [ "$(WITH_REDIS)" = "0" ]; then \
		echo "up: with postgres, without redis (fail-open, keep USER_REDIS_URL for reconnect)"; \
		$(COMPOSE) up -d --build --wait user-postgres user-migrator; \
		$(COMPOSE) up -d --build --no-deps --wait user-service; \
	elif [ "$(WITH_POSTGRES)" = "0" ] && [ "$(WITH_REDIS)" = "1" ]; then \
		echo "up: without postgres (SERVICE_UNAVAILABLE, /ready 503), with redis"; \
		$(COMPOSE) up -d --build --wait user-redis; \
		$(COMPOSE) up -d --build --no-deps --wait user-service; \
	else \
		echo "up: without postgres and redis (fully degraded)"; \
		$(COMPOSE) up -d --build --no-deps --wait user-service; \
	fi

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

clean:
	$(COMPOSE) down -v --remove-orphans

# Backwards-compat aliases
local-up: up
local-down: down
local-logs: logs
local-clean: clean
