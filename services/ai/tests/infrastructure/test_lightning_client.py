import pytest
import respx
import httpx
import asyncio
from unittest.mock import MagicMock, AsyncMock
from src.infrastructure.llm.lightning_client import LightningClient
from src.core.exceptions import LLMProviderError
from src.config.settings import settings

@pytest.fixture
def client():
    return LightningClient(httpx.AsyncClient())

@pytest.mark.asyncio
@respx.mock
async def test_generate_completion_success(client):
    route = respx.post(settings.LIGHTNING_AI_URL).mock(
        return_value=httpx.Response(
            200, 
            json={"choices": [{"message": {"content": "Hello AI"}}]}
        )
    )

    result = await client.generate_completion("sys", "user")
    assert result == "Hello AI"
    assert route.called

@pytest.mark.asyncio
async def test_generate_completion_cancelled():
    mock_http = MagicMock(spec=httpx.AsyncClient)
    mock_http.post = AsyncMock(side_effect=asyncio.CancelledError())
    
    client = LightningClient(mock_http)

    with pytest.raises(asyncio.CancelledError):
        await client.generate_completion("sys", "user")

@pytest.mark.asyncio
@respx.mock
async def test_generate_completion_retry_logic(client):
    route = respx.post(settings.LIGHTNING_AI_URL).mock(
        side_effect=[
            httpx.Response(500),
            httpx.Response(500),
            httpx.Response(200, json={"choices": [{"message": {"content": "Success"}}]})
        ]
    )

    result = await client.generate_completion("sys", "user")
    assert result == "Success"
    assert route.call_count == 3

@pytest.mark.asyncio
@respx.mock
async def test_generate_completion_api_error(client):
    respx.post(settings.LIGHTNING_AI_URL).mock(return_value=httpx.Response(401))

    with pytest.raises(LLMProviderError) as exc:
        await client.generate_completion("sys", "user")
    
    assert "401" in str(exc.value)

@pytest.mark.asyncio
@respx.mock
async def test_generate_completion_network_error(client):
    respx.post(settings.LIGHTNING_AI_URL).mock(side_effect=httpx.RequestError("DNS Fail"))

    with pytest.raises(LLMProviderError) as exc:
        await client.generate_completion("sys", "user")
    
    assert "Failed to communicate" in str(exc.value)

@pytest.mark.asyncio
@respx.mock
async def test_generate_completion_parsing_error(client):
    respx.post(settings.LIGHTNING_AI_URL).mock(
        return_value=httpx.Response(200, json={"wrong": "format"})
    )

    with pytest.raises(LLMProviderError) as exc:
        await client.generate_completion("sys", "user")
    
    assert "Invalid response format" in str(exc.value)