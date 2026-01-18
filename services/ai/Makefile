.PHONY: install generate run clean

install:
	pip install -r requirements.txt

generate:
	mkdir -p src/generated
	python -m grpc_tools.protoc -I. --python_out=src/generated --grpc_python_out=src/generated proto/ai_service.proto
	find src/generated -type f -name "*.py" -exec sed -i 's/^import ai_service_pb2/from . import ai_service_pb2/' {} +

run:
	python src/main.py

clean:
	rm -rf src/generated