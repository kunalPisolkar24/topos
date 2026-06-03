.PHONY: install generate run clean lint test
.PHONY: load-test-server load-test-install
.PHONY: load-test-summary load-test-tags load-test-post load-test-mixed

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

# --- Load testing targets ---

# Overridable parameters
RPS ?= 10
DURATION ?= 30s
VUS ?= 5
TARGET ?= localhost:50051
USE_DOCKER ?= false
K6_IMAGE ?= grafana/k6:latest

load-test-server:
	LOAD_TEST_MODE=true poetry run python -m src.main

load-test-install:
	which k6 || (echo "Installing k6..." && curl -s https://dl.k6.io/install.sh | bash)

define k6_command
$(if $(filter true,$(USE_DOCKER)), \
	docker run --rm --network host \
		-v "$$(PWD)/load-tests:/load-tests" \
		-e PROTO_DIR=/load-tests/proto \
		-e TARGET=$(TARGET) \
		-e VUS=$(VUS) \
		-e DURATION=$(DURATION) \
		-e RPS=$(RPS) \
		$(K6_IMAGE) run \
		--vus $(VUS) --duration $(DURATION) \
		--rps $(RPS) \
		/load-tests/k6/$(1).js, \
	k6 run \
		-e PROTO_DIR=load-tests/proto \
		-e TARGET=$(TARGET) \
		-e VUS=$(VUS) \
		-e DURATION=$(DURATION) \
		-e RPS=$(RPS) \
		--vus $(VUS) --duration $(DURATION) \
		--rps $(RPS) \
		load-tests/k6/$(1).js)
endef

load-test-summary:
	$(call k6_command,generate_summary)

load-test-tags:
	$(call k6_command,generate_tags)

load-test-post:
	$(call k6_command,generate_post)

load-test-mixed:
	$(call k6_command,mixed)