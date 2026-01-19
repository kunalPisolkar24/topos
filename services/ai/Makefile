.PHONY: install generate run clean lint test

VENV := venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

install:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

generate:
	mkdir -p src/generated
	touch src/generated/__init__.py
	$(PYTHON) -m grpc_tools.protoc -Iproto --python_out=src/generated --grpc_python_out=src/generated ai_service.proto
	find src/generated -type f -name "*.py" -exec sed -i 's/^import ai_service_pb2/from . import ai_service_pb2/' {} +

run:
	$(PYTHON) -m src.main

clean:
	rm -rf src/generated
	rm -rf $(VENV)
	find . -type d -name "__pycache__" -exec rm -rf {} +

lint:
	$(PIP) install flake8
	$(VENV)/bin/flake8 src

test:
	$(PYTHON) -m pytest tests