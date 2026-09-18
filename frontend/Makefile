.PHONY: help install build build-preview build-prod dev dev-mock dev-preview preview serve codegen lint test test-integration test-coverage clean
.PHONY: compose-up compose-down compose-logs compose-config compose-build compose-restart compose-ps compose-clean
.PHONY: fetch-prod-env compose-config-prod compose-build-prod compose-up-prod compose-up-preview compose-restart-prod compose-down-prod compose-logs-prod compose-ps-prod

VITE_ENV_TYPE ?= dev
NPM ?= npm
COMPOSE := docker compose -f infra/compose.yml
COMPOSE_PROD := docker compose -f infra/compose.yml --env-file .env.aws
ENV_AWS_FILE := .env.aws
FETCH_ENV := ./infra/fetch-env.sh

help:
	@echo "Frontend — cd frontend && make <target> (e.g. make dev-preview)"
	@echo ""
	@echo "  make dev              - Run against real gateway (VITE_ENV_TYPE=dev)"
	@echo "  make dev-mock         - Run with in-memory mock (VITE_ENABLE_MOCKS=true)"
	@echo "  make dev-preview      - Run with IndexedDB preview (VITE_ENV_TYPE=preview)"
	@echo "  make build            - Build (respects VITE_ENV_TYPE, default dev)"
	@echo "  make build-preview    - Build for preview (VITE_ENV_TYPE=preview)"
	@echo "  make build-prod       - Build for prod (VITE_ENV_TYPE=prod)"
	@echo "  make preview/serve    - Serve built dist (vite preview)"
	@echo "  make codegen          - Generate GraphQL types"
	@echo "  make lint             - tsc --noEmit && eslint"
	@echo "  make test             - Unit tests (vitest)"
	@echo "  make test-integration - Integration tests (testcontainers)"
	@echo "  make test-coverage    - Coverage"
	@echo "  make install          - npm ci"
	@echo "  make clean            - Remove dist/coverage/.vite"
	@echo ""
	@echo "  Docker (infra/compose.yml, single image for dev/preview/prod):"
	@echo "  make compose-up       - Build and start frontend container (dev)"
	@echo "  make compose-down     - Stop and remove frontend container"
	@echo "  make compose-logs     - Tail frontend logs"
	@echo "  make compose-config   - Validate and view compose config"
	@echo "  make compose-build    - Build frontend image once (dummy baked, runtime config wins)"
	@echo "  make compose-restart  - Restart frontend container"
	@echo "  make compose-ps       - List frontend container"
	@echo "  make compose-clean    - Stop and remove container + volumes"
	@echo "  make compose-up-preview - Run same image in preview mode (no AWS, no rebuild)"
	@echo "  make fetch-prod-env   - Fetch prod config from AWS SSM/SM into .env.aws (needs VITE_ENV_TYPE=prod)"
	@echo "  make compose-config-prod - Validate prod compose config (fetches AWS first)"
	@echo "  make compose-up-prod  - Fetch AWS prod config and run same image (no rebuild)"
	@echo "  make compose-down-prod - Stop prod frontend container"

install:
	$(NPM) ci

build:
	$(NPM) run build

build-preview:
	VITE_ENV_TYPE=preview $(NPM) run build

build-prod:
	VITE_ENV_TYPE=prod $(NPM) run build

dev:
	$(NPM) run dev

dev-mock:
	$(NPM) run dev:mock

dev-preview:
	$(NPM) run dev:preview

preview:
	$(NPM) run preview

serve:
	$(NPM) run serve

codegen:
	$(NPM) run codegen

lint:
	$(NPM) run lint

test:
	$(NPM) test

test-integration:
	$(NPM) run test:integration

test-coverage:
	$(NPM) run test:coverage

clean:
	rm -rf dist coverage node_modules/.vite

# --- Docker Compose (frontend/infra/compose.yml) ---

compose-config:
	$(COMPOSE) config

compose-build:
	$(COMPOSE) build

compose-up:
	$(COMPOSE) up -d --build

compose-down:
	$(COMPOSE) down

compose-logs:
	$(COMPOSE) logs -f

compose-ps:
	$(COMPOSE) ps

compose-restart:
	$(COMPOSE) down
	$(COMPOSE) up -d --build

compose-clean:
	$(COMPOSE) down -v --remove-orphans

# --- Single image: dev/preview/prod via runtime /config.js ---

compose-up-preview:
	VITE_ENV_TYPE=preview $(COMPOSE) up -d

fetch-prod-env:
	VITE_ENV_TYPE=prod $(FETCH_ENV) --output $(ENV_AWS_FILE)

compose-config-prod: fetch-prod-env
	$(COMPOSE_PROD) config

compose-build-prod: fetch-prod-env
	$(COMPOSE_PROD) build

compose-up-prod: fetch-prod-env
	$(COMPOSE_PROD) up -d

compose-restart-prod: fetch-prod-env
	$(COMPOSE_PROD) down
	$(COMPOSE_PROD) up -d

compose-down-prod:
	$(COMPOSE_PROD) down

compose-logs-prod:
	$(COMPOSE_PROD) logs -f

compose-ps-prod:
	$(COMPOSE_PROD) ps
