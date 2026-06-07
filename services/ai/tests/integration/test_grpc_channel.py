import pytest
import grpc
import asyncio
import respx
from unittest.mock import patch
from src.api.handlers import AIHandler
from src.generated import ai_service_pb2, ai_service_pb2_grpc
from src.config.settings import settings


@pytest.mark.asyncio
@respx.mock
async def test_generate_summary_via_grpc_channel(grpc_server_and_stub):
    stub = grpc_server_and_stub

    respx.post(settings.LIGHTNING_AI_URL).respond(
        200, json={"choices": [{"message": {"content": "Summary from gRPC"}}]}
    )

    request = ai_service_pb2.ContentRequest(text="<p>Test content</p>")
    response = await stub.GenerateSummary(request, timeout=5)

    assert response.summary == "Summary from gRPC"


@pytest.mark.asyncio
@respx.mock
async def test_generate_tags_via_grpc_channel(grpc_server_and_stub):
    stub = grpc_server_and_stub

    respx.post(settings.LIGHTNING_AI_URL).respond(
        200,
        json={"choices": [{"message": {"content": '["tag1", "tag2"]'}}]},
    )

    request = ai_service_pb2.ContextRequest(title="Title", body="<p>Body</p>")
    response = await stub.GenerateTags(request, timeout=5)

    assert response.tags == ["tag1", "tag2"]


@pytest.mark.asyncio
@respx.mock
async def test_generate_post_via_grpc_channel(grpc_server_and_stub):
    stub = grpc_server_and_stub

    respx.post(settings.LIGHTNING_AI_URL).respond(
        200,
        json={
            "choices": [
                {
                    "message": {
                        "content": (
                            '{"title": "GRPC Post", '
                            '"body": "<p>Content</p>", '
                            '"summary": "Summary", '
                            '"tags": ["g", "r", "p", "c"]}'
                        )
                    }
                }
            ]
        },
    )

    request = ai_service_pb2.PostGenerationRequest(prompt="Write about gRPC")
    response = await stub.GeneratePost(request, timeout=5)

    assert response.title == "GRPC Post"
    assert response.body == "<p>Content</p>"
    assert response.summary == "Summary"
    assert response.tags == ["g", "r", "p", "c"]


@pytest.mark.asyncio
async def test_grpc_cancellation(integration_logic):
    handler = AIHandler(integration_logic)
    server = grpc.aio.server()
    ai_service_pb2_grpc.add_AIServiceServicer_to_server(handler, server)
    port = server.add_insecure_port("localhost:0")
    await server.start()

    channel = grpc.aio.insecure_channel(f"localhost:{port}")
    stub = ai_service_pb2_grpc.AIServiceStub(channel)

    async def never_respond(payload):
        await asyncio.Event().wait()

    with patch.object(handler.logic.llm, "_make_request", never_respond):
        request = ai_service_pb2.ContentRequest(text="content")
        call = stub.GenerateSummary(request)
        await asyncio.sleep(0.1)
        call.cancel()

        with pytest.raises(asyncio.CancelledError):
            await call

    await channel.close()
    await server.stop(grace=None)


@pytest.mark.asyncio
async def test_grpc_unknown_method_returns_unimplemented(integration_logic):
    handler = AIHandler(integration_logic)
    server = grpc.aio.server()
    ai_service_pb2_grpc.add_AIServiceServicer_to_server(handler, server)
    port = server.add_insecure_port("localhost:0")
    await server.start()

    channel = grpc.aio.insecure_channel(f"localhost:{port}")

    with pytest.raises(grpc.aio.AioRpcError) as exc:
        await channel.unary_unary(
            "/ai.AIService/NonExistent",
            request_serializer=ai_service_pb2.ContentRequest.SerializeToString,
            response_deserializer=ai_service_pb2.ContentResponse.FromString,
        )(ai_service_pb2.ContentRequest(text="test"))

    assert exc.value.code() == grpc.StatusCode.UNIMPLEMENTED

    await channel.close()
    await server.stop(grace=None)
