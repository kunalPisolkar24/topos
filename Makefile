.PHONY: help build ensure-network up down logs restart clean prune

ENV_FILE ?= .env
APP_NETWORK ?= blog_app_network
COMPOSE ?= docker compose --env-file $(ENV_FILE)

help:
	@echo "Available commands:"
	@echo "  make build    - Build all docker containers"
	@echo "  make ensure-network - Ensure the external docker network exists"
	@echo "  make up       - Start all services in the background"
	@echo "  make down     - Stop and remove all containers, networks"
	@echo "  make restart  - Restart all services"
	@echo "  make logs     - View logs from all services"
	@echo "  make clean    - Stop services and remove volumes"
	@echo "  make prune    - Prune completely out all unused docker resources"

build:
	$(COMPOSE) build

ensure-network:
	@network="$(APP_NETWORK)"; \
	if [ -f "$(ENV_FILE)" ]; then \
		env_network="$$(awk -F= '/^APP_NETWORK=/{print substr($$0, index($$0, "=")+1); exit}' "$(ENV_FILE)")"; \
		if [ -n "$$env_network" ]; then network="$$env_network"; fi; \
	fi; \
	docker network inspect "$$network" >/dev/null 2>&1 || \
		docker network create --driver bridge "$$network" >/dev/null

up: ensure-network
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

restart:
	$(MAKE) down
	$(MAKE) up

logs:
	$(COMPOSE) logs -f

clean:
	$(COMPOSE) down -v

prune:
	docker system prune -a --volumes -f
