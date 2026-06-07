import pytest
import asyncio
import respx
from unittest.mock import MagicMock, AsyncMock
from src.generated import ai_service_pb2
from src.config.settings import settings


@pytest.mark.asyncio
@respx.mock
async def test_concurrent_summary_requests(integration_handler):
    respx.post(settings.LIGHTNING_AI_URL).respond(
        200, json={"choices": [{"message": {"content": "Summary"}}]}
    )

    def make_context():
        ctx = MagicMock()
        ctx.abort = AsyncMock()
        return ctx

    contexts = [make_context() for _ in range(10)]
    request = ai_service_pb2.ContentRequest(text="<p>Content</p>")

    async def call(i):
        return await integration_handler.GenerateSummary(request, contexts[i])

    results = await asyncio.gather(*[call(i) for i in range(10)], return_exceptions=True)

    for r in results:
        assert r.summary == "Summary"


@pytest.mark.asyncio
@respx.mock
async def test_large_payload_handling(integration_handler, mock_grpc_context):
    route = respx.post(settings.LIGHTNING_AI_URL).respond(
        200, json={"choices": [{"message": {"content": "Summary of large text"}}]}
    )

    large_html = "<p>" + "A" * 10000 + "</p>"
    request = ai_service_pb2.ContentRequest(text=large_html)
    response = await integration_handler.GenerateSummary(request, mock_grpc_context)

    assert response.summary == "Summary of large text"
    assert route.call_count == 1
