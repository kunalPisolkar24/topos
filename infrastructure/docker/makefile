COMPOSE_FILE=docker-compose.basic.yml

up:
	docker compose -f $(COMPOSE_FILE) up -d

down:
	docker compose -f $(COMPOSE_FILE) down

build:
	docker compose -f $(COMPOSE_FILE) up --build -d

logs:
	docker compose -f $(COMPOSE_FILE) logs -f