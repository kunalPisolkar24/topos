import pytest
import grpc
import asyncio
from unittest.mock import MagicMock, AsyncMock
from src.api.handlers import AIHandler
from src.core.exceptions import LLMProviderError, DataParsingError
from src.core.domain.models import GeneratedPost

@pytest.fixture
def mock_logic():
    return MagicMock()

@pytest.fixture
def handler(mock_logic):
    return AIHandler(mock_logic)

@pytest.mark.asyncio
async def test_generate_summary_success(handler, mock_logic, mock_grpc_context):
    request = MagicMock(text="content")
    mock_logic.generate_summary = AsyncMock(return_value="Summary")
    
    response = await handler.GenerateSummary(request, mock_grpc_context)
    
    assert response.summary == "Summary"

@pytest.mark.asyncio
async def test_generate_summary_cancelled(handler, mock_logic, mock_grpc_context):
    request = MagicMock(text="content")
    mock_logic.generate_summary = AsyncMock(side_effect=asyncio.CancelledError)
    
    await handler.GenerateSummary(request, mock_grpc_context)
    
    mock_grpc_context.abort.assert_called_with(grpc.StatusCode.CANCELLED, "Request cancelled")

@pytest.mark.asyncio
async def test_generate_summary_error(handler, mock_logic, mock_grpc_context):
    request = MagicMock(text="content")
    mock_logic.generate_summary = AsyncMock(side_effect=LLMProviderError("Fail"))
    
    await handler.GenerateSummary(request, mock_grpc_context)
    
    mock_grpc_context.abort.assert_called_with(grpc.StatusCode.UNAVAILABLE, "Fail")

@pytest.mark.asyncio
async def test_generate_tags_success(handler, mock_logic, mock_grpc_context):
    request = MagicMock(title="T", body="B")
    mock_logic.generate_tags = AsyncMock(return_value=["tag1"])
    
    response = await handler.GenerateTags(request, mock_grpc_context)
    
    assert response.tags == ["tag1"]

@pytest.mark.asyncio
async def test_generate_tags_cancelled(handler, mock_logic, mock_grpc_context):
    request = MagicMock(title="T", body="B")
    mock_logic.generate_tags = AsyncMock(side_effect=asyncio.CancelledError)
    
    await handler.GenerateTags(request, mock_grpc_context)
    
    mock_grpc_context.abort.assert_called_with(grpc.StatusCode.CANCELLED, "Request cancelled")

@pytest.mark.asyncio
async def test_generate_post_success(handler, mock_logic, mock_grpc_context):
    request = MagicMock(prompt="topic")
    post = GeneratedPost(
        title="T", body="B", summary="S", tags=["t1"]
    )
    mock_logic.generate_post = AsyncMock(return_value=post)
    
    response = await handler.GeneratePost(request, mock_grpc_context)
    
    assert response.title == "T"

@pytest.mark.asyncio
async def test_generate_post_cancelled(handler, mock_logic, mock_grpc_context):
    request = MagicMock(prompt="topic")
    mock_logic.generate_post = AsyncMock(side_effect=asyncio.CancelledError)
    
    await handler.GeneratePost(request, mock_grpc_context)
    
    mock_grpc_context.abort.assert_called_with(grpc.StatusCode.CANCELLED, "Request cancelled")

@pytest.mark.asyncio
async def test_generate_post_parsing_error(handler, mock_logic, mock_grpc_context):
    request = MagicMock(prompt="topic")
    mock_logic.generate_post = AsyncMock(side_effect=DataParsingError("Invalid JSON"))
    
    await handler.GeneratePost(request, mock_grpc_context)
    
    mock_grpc_context.abort.assert_called_with(grpc.StatusCode.DATA_LOSS, "Invalid JSON")

@pytest.mark.asyncio
async def test_generate_post_generic_exception(handler, mock_logic, mock_grpc_context):
    request = MagicMock(prompt="topic")
    mock_logic.generate_post = AsyncMock(side_effect=Exception("Boom"))
    
    await handler.GeneratePost(request, mock_grpc_context)
    
    mock_grpc_context.abort.assert_called_with(grpc.StatusCode.INTERNAL, "Internal service error")