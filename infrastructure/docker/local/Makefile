.PHONY: up down logs ps clean

COMPOSE := docker compose --env-file .env.local -f compose.yml

up:
	$(COMPOSE) up -d --build --wait

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

clean:
	$(COMPOSE) down -v --remove-orphans
