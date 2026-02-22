.PHONY: help build up down logs restart clean prune

help:
	@echo "Available commands:"
	@echo "  make build    - Build all docker containers"
	@echo "  make up       - Start all services in the background"
	@echo "  make down     - Stop and remove all containers, networks"
	@echo "  make restart  - Restart all services"
	@echo "  make logs     - View logs from all services"
	@echo "  make clean    - Stop services and remove volumes"
	@echo "  make prune    - Prune completely out all unused docker resources"

build:
	docker compose --env-file .env build

up:
	docker compose --env-file .env up -d

down:
	docker compose --env-file .env down

restart:
	docker compose --env-file .env down
	docker compose --env-file .env up -d

logs:
	docker compose --env-file .env logs -f

clean:
	docker compose --env-file .env down -v

prune:
	docker system prune -a --volumes -f
