import asyncio
import json
from src.core.interfaces.llm_provider import LLMProvider
from src.config.settings import settings


MOCK_SUMMARY = (
    "This content discusses key developments in the field. "
    "The main findings highlight significant trends and their implications. "
    "Overall, the analysis provides valuable insights for future research."
)

MOCK_TAGS = json.dumps([
    "technology", "innovation", "software",
    "development", "artificial-intelligence"
])

MOCK_POST = json.dumps({
    "title": "The Future of Technology: Key Trends Shaping Our World",
    "body": (
        "<h2>Introduction</h2>"
        "<p>Technology continues to evolve at a rapid pace, "
        "transforming every aspect of our lives.</p>"
        "<h2>Key Developments</h2>"
        "<p>Recent advances in artificial intelligence "
        "and machine learning have opened new possibilities.</p>"
        "<ul><li>Improved natural language processing</li>"
        "<li>Enhanced computer vision capabilities</li></ul>"
        "<h2>Conclusion</h2>"
        "<p>These trends will continue to shape "
        "the future of technology and society.</p>"
    ),
    "summary": (
        "Technology is evolving rapidly with key advances "
        "in AI and machine learning. "
        "These developments are transforming industries "
        "and creating new opportunities. "
        "The future promises even more groundbreaking innovations."
    ),
    "tags": [
        "technology", "AI", "innovation",
        "future", "machine-learning"
    ]
})


class MockLLMProvider(LLMProvider):
    def __init__(self):
        self.delay_ms = settings.MOCK_DELAY_MS

    async def generate_completion(
        self, system_prompt: str, user_content: str
    ) -> str:
        if self.delay_ms > 0:
            await asyncio.sleep(self.delay_ms / 1000.0)

        sp_lower = system_prompt.lower()
        if "tags" in sp_lower and "json" not in sp_lower:
            return MOCK_TAGS
        if "blog" in sp_lower:
            return MOCK_POST
        if "keywords" in sp_lower or "tags" in sp_lower:
            return MOCK_TAGS

        return MOCK_SUMMARY
