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
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose down
	docker compose up -d

logs:
	docker compose logs -f

clean:
	docker compose down -v

prune:
	docker system prune -a --volumes -f
