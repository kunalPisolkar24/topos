.PHONY: help local-up local-down local-logs local-ps local-clean prune

LOCAL_DIR := infrastructure/docker/local
LOCAL_ENV := $(LOCAL_DIR)/.env.local
LOCAL_ENV_EXAMPLE := $(LOCAL_DIR)/.env.local.example
COMPOSE_LOCAL := docker compose --env-file $(LOCAL_ENV) -f $(LOCAL_DIR)/compose.yml

help:
	@echo "Available commands:"
	@echo ""
	@echo "  Local full stack (single entry point):"
	@echo "  make local-up     - Build and start all local containers"
	@echo "  make local-logs   - Tail logs"
	@echo "  make local-ps     - List containers"
	@echo "  make local-down   - Stop (keeps volumes)"
	@echo "  make local-clean  - Stop and delete volumes"
	@echo ""
	@echo "  Utilities:"
	@echo "  make prune    - Prune completely out all unused docker resources"
	@echo ""
	@echo "  Frontend:"
	@echo "  cd frontend && make <target> — see frontend/Makefile (e.g. make dev-preview)"
	@echo "  (from repo root: make -C frontend <target>)"

$(LOCAL_ENV):
	@cp $(LOCAL_ENV_EXAMPLE) $(LOCAL_ENV)
	@echo "Created $(LOCAL_ENV) from example — fill in any required values."

local-up: $(LOCAL_ENV)
	$(COMPOSE_LOCAL) up -d --build --wait

local-down: $(LOCAL_ENV)
	$(COMPOSE_LOCAL) down

local-logs: $(LOCAL_ENV)
	$(COMPOSE_LOCAL) logs -f

local-ps: $(LOCAL_ENV)
	$(COMPOSE_LOCAL) ps

local-clean: $(LOCAL_ENV)
	$(COMPOSE_LOCAL) down -v --remove-orphans

prune:
	docker system prune -a --volumes -f
