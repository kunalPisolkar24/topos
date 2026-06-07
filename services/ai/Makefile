.PHONY: install generate run clean lint test
.PHONY: load-test build-load-test-image load-test-stop

# --- Python targets ---

install:
	poetry install

generate:
	mkdir -p src/generated
	touch src/generated/__init__.py
	poetry run python -m grpc_tools.protoc -Iproto --python_out=src/generated --grpc_python_out=src/generated ai_service.proto
	find src/generated -type f -name "*.py" -exec sed -i 's/^import ai_service_pb2/from . import ai_service_pb2/' {} +

run:
	poetry run python -m src.main

clean:
	rm -rf src/generated
	rm -rf .venv
	find . -type d -name "__pycache__" -exec rm -rf {} +
	rm -f .coverage
	rm -rf htmlcov
	rm -rf .pytest_cache

lint:
	poetry run flake8 src

test-coverage:
	PYTHONPATH=. poetry run pytest tests -v --cov=src --cov-report=term-missing --asyncio-mode=auto

test:
	PYTHONPATH=. poetry run pytest tests -v \
		--cov=src \
		--cov-report=term-missing \
		--cov-fail-under=80 \
		--asyncio-mode=auto

# --- Load testing (Docker only, no host installs) ---

RPS ?= 10
DURATION ?= 30s
VUS ?= 5
SCRIPT ?= mixed

build-load-test-image:
	docker build -t topos-ai-service .

load-test: build-load-test-image
	docker network create load-test-net 2>/dev/null || true
	docker rm -f ai-service 2>/dev/null || true
	docker run -d --rm --name ai-service \
		--network load-test-net \
		-e LOAD_TEST_MODE=true \
		topos-ai-service
	sleep 3
	docker run --rm --network load-test-net \
		-e PROTO_DIR=/load-tests/proto \
		-e TARGET=ai-service:50051 \
		-e VUS=$(VUS) -e DURATION=$(DURATION) -e RPS=$(RPS) \
		-v "$(PWD)/load-tests:/load-tests" \
		grafana/k6:latest run \
		--vus $(VUS) --duration $(DURATION) --rps $(RPS) \
		/load-tests/k6/$(SCRIPT).js; \
		EXIT_CODE=$$?; \
		docker rm -f ai-service 2>/dev/null || true; \
		docker network rm load-test-net 2>/dev/null || true; \
		exit $$EXIT_CODE

load-test-stop:
	docker rm -f ai-service 2>/dev/null || true
	docker network rm load-test-net 2>/dev/null || true