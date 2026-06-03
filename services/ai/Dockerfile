FROM python:3.12-slim as builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml poetry.lock* ./
RUN pip install --no-cache-dir poetry && \
    poetry config virtualenvs.create false && \
    poetry install --no-root --no-dev --no-interaction

COPY . .

RUN mkdir -p src/generated && \
    touch src/generated/__init__.py && \
    python3 -m grpc_tools.protoc -Iproto --python_out=src/generated --grpc_python_out=src/generated ai_service.proto && \
    find src/generated -type f -name "*.py" -exec sed -i 's/^import ai_service_pb2/from . import ai_service_pb2/' {} +

FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN groupadd -r appuser && useradd -r -g appuser appuser

COPY --from=builder /usr/local /usr/local
COPY --from=builder --chown=appuser:appuser /app/src /app/src

USER appuser

EXPOSE 50051
EXPOSE 9090

CMD ["python3", "-m", "src.main"]
