import pytest
import httpx
import grpc
from src.api.handlers import AIHandler
from src.generated import ai_service_pb2_grpc
from src.infrastructure.llm.lightning_client import LightningClient
from src.usecases.content_logic import ContentLogic


@pytest.fixture
async def integration_http_client():
    async with httpx.AsyncClient() as client:
        yield client


@pytest.fixture
async def integration_llm_client(integration_http_client):
    return LightningClient(integration_http_client)


@pytest.fixture
async def integration_logic(integration_llm_client):
    return ContentLogic(integration_llm_client)


@pytest.fixture
async def integration_handler(integration_logic):
    return AIHandler(integration_logic)


@pytest.fixture
async def grpc_server_and_stub(integration_logic):
    server = grpc.aio.server()
    handler = AIHandler(integration_logic)
    ai_service_pb2_grpc.add_AIServiceServicer_to_server(handler, server)
    port = server.add_insecure_port("localhost:0")
    await server.start()

    channel = grpc.aio.insecure_channel(f"localhost:{port}")
    stub = ai_service_pb2_grpc.AIServiceStub(channel)

    yield stub

    await channel.close()
    await server.stop(grace=None)
