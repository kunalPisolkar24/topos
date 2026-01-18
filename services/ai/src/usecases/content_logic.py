import json
import logging
from typing import List
from src.core.interfaces.llm_provider import LLMProvider
from src.utils.text_cleaner import TextCleaner
from src.core.domain.models import GeneratedPost
from src.core.exceptions import DataParsingError

class ContentLogic:
    def __init__(self, llm_provider: LLMProvider):
        self.llm = llm_provider
        self.cleaner = TextCleaner()
        self.logger = logging.getLogger(__name__)

    async def generate_summary(self, html_text: str) -> str:
        clean_text = self.cleaner.clean_html(html_text)
        if not clean_text:
            return ""
        
        prompt = "Summarize the following text in 3 concise sentences."
        return await self.llm.generate_completion(prompt, clean_text)

    async def generate_tags(self, title: str, body: str) -> List[str]:
        clean_body = self.cleaner.clean_html(body)
        content = f"Title: {title}\nBody: {clean_body[:3000]}"
        
        prompt = (
            "Analyze the content and extract 5-7 relevant SEO tags. "
            "Output strictly a JSON array of strings. Example: [\"tech\", \"code\"]."
        )
        
        raw_response = await self.llm.generate_completion(prompt, content)
        json_str = self.cleaner.extract_json_block(raw_response)
        
        try:
            tags = json.loads(json_str)
            if isinstance(tags, list):
                return [str(t) for t in tags]
            raise ValueError
        except (json.JSONDecodeError, ValueError):
            self.logger.error(f"Failed to parse tags JSON: {json_str}")
            raise DataParsingError("AI returned invalid tag format")

    async def generate_post(self, user_prompt: str) -> GeneratedPost:
        system_prompt = (
            "You are a professional tech blogger. Write a blog post based on the prompt. "
            "Return strict JSON with keys: 'title', 'body' (Markdown), 'summary', 'tags' (array)."
        )
        
        raw_response = await self.llm.generate_completion(system_prompt, user_prompt)
        json_str = self.cleaner.extract_json_block(raw_response)
        
        try:
            data = json.loads(json_str)
            return GeneratedPost(
                title=data.get("title", "Untitled"),
                body=data.get("body", ""),
                summary=data.get("summary", ""),
                tags=data.get("tags", [])
            )
        except (json.JSONDecodeError, ValueError):
            self.logger.error(f"Failed to parse post JSON: {json_str}")
            raise DataParsingError("AI returned invalid post format")