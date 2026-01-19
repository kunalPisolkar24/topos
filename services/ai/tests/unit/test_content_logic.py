import pytest
from src.usecases.content_logic import ContentLogic
from src.core.exceptions import DataParsingError
from src.core.domain.models import GeneratedPost

@pytest.fixture
def logic(mock_llm_provider):
    return ContentLogic(mock_llm_provider)

@pytest.mark.asyncio
async def test_generate_summary_success(logic, mock_llm_provider):
    mock_llm_provider.generate_completion.return_value = "Summary text"
    result = await logic.generate_summary("<html><body>Content</body></html>")
    
    assert result == "Summary text"
    mock_llm_provider.generate_completion.assert_called_once()

@pytest.mark.asyncio
async def test_generate_tags_success(logic, mock_llm_provider):
    mock_llm_provider.generate_completion.return_value = '["tag1", "tag2"]'
    result = await logic.generate_tags("Title", "Body")
    
    assert len(result) == 2
    assert "tag1" in result

@pytest.mark.asyncio
async def test_generate_tags_invalid_json(logic, mock_llm_provider):
    mock_llm_provider.generate_completion.return_value = "Not JSON"
    
    with pytest.raises(DataParsingError):
        await logic.generate_tags("Title", "Body")

@pytest.mark.asyncio
async def test_generate_post_success(logic, mock_llm_provider, valid_post_json):
    mock_llm_provider.generate_completion.return_value = valid_post_json
    result = await logic.generate_post("topic")
    
    assert isinstance(result, GeneratedPost)
    assert result.title == "Test Title"
    assert "<h2>" in result.body

@pytest.mark.asyncio
async def test_generate_post_sanitization(logic, mock_llm_provider, malicious_post_json):
    mock_llm_provider.generate_completion.return_value = malicious_post_json
    result = await logic.generate_post("topic")
    
    assert "<script>" not in result.body
    assert "onerror" not in result.body
    assert "<p>Safe</p>" in result.body

@pytest.mark.asyncio
async def test_generate_post_schema_validation(logic, mock_llm_provider):
    # Missing 'title'
    mock_llm_provider.generate_completion.return_value = '{"body": "content"}'
    
    with pytest.raises(DataParsingError):
        await logic.generate_post("topic")