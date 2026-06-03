.PHONY: install generate run clean lint test

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