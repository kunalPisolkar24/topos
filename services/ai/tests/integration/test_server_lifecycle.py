import pytest
import grpc
import httpx
import socket
from contextlib import closing
from prometheus_client import start_http_server, REGISTRY
from src.api.handlers import AIHandler
from src.generated import ai_service_pb2_grpc, ai_service_pb2
from src.infrastructure.monitoring.interceptors import PrometheusInterceptor


def _find_free_port():
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.bind(("", 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]


@pytest.mark.asyncio
async def test_grpc_server_starts_and_stops(integration_logic):
    server = grpc.aio.server()
    handler = AIHandler(integration_logic)
    ai_service_pb2_grpc.add_AIServiceServicer_to_server(handler, server)
    port = server.add_insecure_port("localhost:0")

    await server.start()

    channel = grpc.aio.insecure_channel(f"localhost:{port}")
    stub = ai_service_pb2_grpc.AIServiceStub(channel)

    state = channel.get_state(try_to_connect=True)
    assert state in (grpc.ChannelConnectivity.IDLE, grpc.ChannelConnectivity.READY)

    await channel.close()
    await server.stop(grace=None)


@pytest.mark.asyncio
async def test_grpc_server_with_interceptor_starts_and_stops(integration_logic):
    interceptor = PrometheusInterceptor()
    server = grpc.aio.server(interceptors=[interceptor])
    handler = AIHandler(integration_logic)
    ai_service_pb2_grpc.add_AIServiceServicer_to_server(handler, server)
    server.add_insecure_port("localhost:0")

    await server.start()

    channel = grpc.aio.insecure_channel("localhost:0")
    stub = ai_service_pb2_grpc.AIServiceStub(channel)

    await channel.close()
    await server.stop(grace=None)


@pytest.mark.asyncio
async def test_prometheus_metrics_endpoint():
    port = _find_free_port()
    start_http_server(port)

    async with httpx.AsyncClient() as client:
        response = await client.get(f"http://localhost:{port}/")

    assert response.status_code == 200
    assert "grpc_requests_total" in response.text
    assert "grpc_request_duration_seconds" in response.text
    assert "llm_provider_duration_seconds" in response.text
    assert "llm_provider_errors_total" in response.text
    assert "grpc_active_requests" in response.text
