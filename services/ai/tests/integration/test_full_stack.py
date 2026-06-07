import pytest
import grpc
import httpx
import respx
from unittest.mock import patch, MagicMock, ANY
from src.generated import ai_service_pb2
from src.config.settings import settings
from src.core.exceptions import LLMProviderError


@pytest.mark.asyncio
@respx.mock
async def test_generate_summary_full_stack(integration_handler, mock_grpc_context):
    route = respx.post(settings.LIGHTNING_AI_URL).respond(
        200, json={"choices": [{"message": {"content": "Short summary text"}}]}
    )

    request = ai_service_pb2.ContentRequest(text="<p>Some article content here</p>")
    response = await integration_handler.GenerateSummary(request, mock_grpc_context)

    assert response.summary == "Short summary text"
    assert route.call_count == 1


@pytest.mark.asyncio
@respx.mock
async def test_generate_tags_full_stack(integration_handler, mock_grpc_context):
    route = respx.post(settings.LIGHTNING_AI_URL).respond(
        200,
        json={"choices": [{"message": {"content": '["tech", "ai", "python"]'}}]},
    )

    request = ai_service_pb2.ContextRequest(
        title="Test Title", body="<p>Test body content</p>"
    )
    response = await integration_handler.GenerateTags(request, mock_grpc_context)

    assert response.tags == ["tech", "ai", "python"]
    assert route.call_count == 1


@pytest.mark.asyncio
@respx.mock
async def test_generate_post_full_stack(integration_handler, mock_grpc_context):
    route = respx.post(settings.LIGHTNING_AI_URL).respond(
        200,
        json={
            "choices": [
                {
                    "message": {
                        "content": (
                            '{"title": "Test Post", '
                            '"body": "<h2>Section</h2><p>Content</p>", '
                            '"summary": "A test", '
                            '"tags": ["tag1"]}'
                        )
                    }
                }
            ]
        },
    )

    request = ai_service_pb2.PostGenerationRequest(prompt="Write about testing")
    response = await integration_handler.GeneratePost(request, mock_grpc_context)

    assert response.title == "Test Post"
    assert response.body == "<h2>Section</h2><p>Content</p>"
    assert response.summary == "A test"
    assert response.tags == ["tag1"]
    assert route.call_count == 1


@pytest.mark.asyncio
@respx.mock
async def test_generate_post_sanitization_full_stack(
    integration_handler, mock_grpc_context
):
    route = respx.post(settings.LIGHTNING_AI_URL).respond(
        200,
        json={
            "choices": [
                {
                    "message": {
                        "content": (
                            '{"title": "XSS Post", '
                            '"body": "<script>alert(1)</script><p>Safe content</p>", '
                            '"summary": "Summary", '
                            '"tags": ["xss"]}'
                        )
                    }
                }
            ]
        },
    )

    request = ai_service_pb2.PostGenerationRequest(prompt="Write about XSS")
    response = await integration_handler.GeneratePost(request, mock_grpc_context)

    assert "<script>" not in response.body
    assert "<p>Safe content</p>" in response.body
    assert route.call_count == 1


@pytest.mark.asyncio
@respx.mock
async def test_empty_input_skips_llm_call(
    integration_handler, mock_grpc_context
):
    route = respx.post(settings.LIGHTNING_AI_URL).respond(
        200, json={"choices": [{"message": {"content": "Should not be called"}}]}
    )

    request = ai_service_pb2.ContentRequest(text="")
    response = await integration_handler.GenerateSummary(request, mock_grpc_context)

    assert response.summary == ""
    assert route.call_count == 0


@pytest.mark.asyncio
async def test_llm_http_error_propagates(
    integration_handler, integration_llm_client, mock_grpc_context
):
    async def mock_request(payload):
        response = MagicMock(status_code=500)
        raise httpx.HTTPStatusError(
            "Server Error", request=MagicMock(), response=response
        )

    with patch.object(integration_llm_client, "_make_request", mock_request):
        request = ai_service_pb2.ContentRequest(text="content")
        await integration_handler.GenerateSummary(request, mock_grpc_context)

    mock_grpc_context.abort.assert_called_with(
        grpc.StatusCode.UNAVAILABLE, "Provider returned 500"
    )


@pytest.mark.asyncio
@respx.mock
async def test_invalid_json_from_llm_propagates(
    integration_handler, mock_grpc_context
):
    respx.post(settings.LIGHTNING_AI_URL).respond(
        200, json={"choices": [{"message": {"content": "Not valid JSON at all"}}]}
    )

    request = ai_service_pb2.ContextRequest(title="T", body="B")
    await integration_handler.GenerateTags(request, mock_grpc_context)

    mock_grpc_context.abort.assert_called_with(
        grpc.StatusCode.DATA_LOSS, "AI returned invalid tag format"
    )


@pytest.mark.asyncio
async def test_network_error_propagates(
    integration_handler, integration_llm_client, mock_grpc_context
):
    async def mock_request(payload):
        raise httpx.RequestError("Connection refused")

    with patch.object(integration_llm_client, "_make_request", mock_request):
        request = ai_service_pb2.ContentRequest(text="content")
        await integration_handler.GenerateSummary(request, mock_grpc_context)

    mock_grpc_context.abort.assert_called_with(
        grpc.StatusCode.UNAVAILABLE, "Failed to communicate with AI provider"
    )
