DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
POETRY := poetry -C $(DIR)
RUN := $(POETRY) run python main.py

.PHONY: help install lint format test test-cov test-all dry-run seed-floci dry-run-floci clean

help:
	@echo "Seed Secrets — usage:"
	@echo "  make install               Install deps (poetry install)"
	@echo "  make lint                  Ruff check"
	@echo "  make format                Ruff format --check (use 'ruff format .' to fix)"
	@echo "  make test                  Unit tests (no integration)"
	@echo "  make test-all              All tests (unit + integration, mocked AWS)"
	@echo "  make test-cov              Unit tests with coverage (fail-under 65)"
	@echo "  make dry-run               Preview against Floci (no writes)"
	@echo "  make seed-floci            Seed to Floci (localhost:4566)"
	@echo "  make clean                 Remove caches"

install:
	$(POETRY) install --no-interaction

lint:
	$(POETRY) run ruff check .

format:
	$(POETRY) run ruff format --check .

test:
	$(POETRY) run pytest -q -o addopts="" -m "not integration"

test-all:
	$(POETRY) run pytest -q -o addopts=""

test-cov:
	$(POETRY) run pytest -m "not integration" --cov=src --cov-report=term-missing --cov-fail-under=65

dry-run:
	$(RUN) --env-file infrastructure/docker/local/.env.local.example --endpoint-url http://localhost:4566 --dry-run

seed-floci:
	$(RUN) --env-file infrastructure/docker/local/.env.local.example --endpoint-url http://localhost:4566

dry-run-floci: dry-run

clean:
	rm -rf .pytest_cache .ruff_cache .coverage htmlcov
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
