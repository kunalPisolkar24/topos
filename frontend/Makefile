.PHONY: help install build build-preview build-prod dev dev-mock dev-preview preview serve codegen lint test test-integration test-coverage clean
.PHONY: compose-up compose-down compose-logs compose-config compose-build compose-restart compose-ps compose-clean

VITE_ENV_TYPE ?= dev
NPM ?= npm
COMPOSE := docker compose -f infra/compose.yml

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
	@echo "  Docker (infra/compose.yml):"
	@echo "  make compose-up       - Build and start frontend container"
	@echo "  make compose-down     - Stop and remove frontend container"
	@echo "  make compose-logs     - Tail frontend logs"
	@echo "  make compose-config   - Validate and view compose config"
	@echo "  make compose-build    - Build frontend image"
	@echo "  make compose-restart  - Restart frontend container"
	@echo "  make compose-ps       - List frontend container"
	@echo "  make compose-clean    - Stop and remove container + volumes"

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
