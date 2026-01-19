import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock
from src.core.interfaces.llm_provider import LLMProvider

@pytest.fixture
def mock_grpc_context():
    context = MagicMock()
    context.abort = AsyncMock()
    return context

@pytest.fixture
def mock_llm_provider():
    provider = MagicMock(spec=LLMProvider)
    provider.generate_completion = AsyncMock()
    return provider

@pytest.fixture
def mock_http_client():
    return httpx.AsyncClient()

@pytest.fixture
def valid_post_json():
    return """
    {
        "title": "Test Title",
        "body": "<h2>Header</h2><p>Content</p>",
        "summary": "Short summary",
        "tags": ["tech", "ai"]
    }
    """

@pytest.fixture
def malicious_post_json():
    return """
    {
        "title": "Hacked",
        "body": "<script>alert('xss')</script><p>Safe</p><img src=x onerror=alert(1)>",
        "summary": "Bad summary",
        "tags": ["hack"]
    }
    """