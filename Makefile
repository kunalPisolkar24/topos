.PHONY: help prune

help:
	@echo "Available commands:"
	@echo ""
	@echo "  Infrastructure compose files have been removed."
	@echo "  Run each service individually via its own compose.yml:"
	@echo "    services/user:    docker compose -f services/user/infra/compose.yml up -d"
	@echo "    services/content: docker compose -f services/content/infra/compose.yml up -d"
	@echo "    services/ai:      docker compose -f services/ai/compose.local.yml up -d"
	@echo "    gateway:          docker compose -f gateway/compose.yml up -d"
	@echo "    frontend:         docker compose -f frontend/infra/compose.yml up -d"
	@echo ""
	@echo "  Utilities:"
	@echo "  make prune    - Prune completely out all unused docker resources"
	@echo ""
	@echo "  Frontend:"
	@echo "  cd frontend && make <target> — see frontend/Makefile (e.g. make dev-preview)"
	@echo "  (from repo root: make -C frontend <target>)"

prune:
	docker system prune -a --volumes -f


