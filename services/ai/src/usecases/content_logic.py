import json
import logging
from typing import List
from pydantic import ValidationError
from src.core.interfaces.llm_provider import LLMProvider
from src.utils.text_cleaner import TextCleaner
from src.utils.sanitizer import Sanitizer
from src.usecases.prompts import Prompts
from src.core.domain.models import GeneratedPost
from src.core.exceptions import DataParsingError, AIServiceException

class ContentLogic:
    def __init__(self, llm_provider: LLMProvider):
        self.llm = llm_provider
        self.cleaner = TextCleaner()
        self.logger = logging.getLogger(__name__)

    async def generate_summary(self, html_text: str) -> str:
        clean_text = self.cleaner.clean_html(html_text)
        if not clean_text:
            return ""
        
        return await self.llm.generate_completion(Prompts.SUMMARY_SYSTEM, clean_text)

    async def generate_tags(self, title: str, body: str) -> List[str]:
        clean_body = self.cleaner.clean_html(body)
        content = f"Title: {title}\nBody: {clean_body[:3000]}"
        
        raw_response = await self.llm.generate_completion(Prompts.TAGS_SYSTEM, content)
        json_str = self.cleaner.extract_json_block(raw_response)
        
        try:
            tags = json.loads(json_str)
            if isinstance(tags, list):
                valid_tags = [str(t) for t in tags if isinstance(t, str)]
                if not valid_tags:
                    raise ValueError("No valid string tags found in response")
                return valid_tags
            raise ValueError("Response is not a list")
        except (json.JSONDecodeError, ValueError) as e:
            self.logger.error(f"Tag parsing failed: {e}. Raw: {json_str}")
            raise DataParsingError("AI returned invalid tag format") from e

    async def generate_post(self, user_topic: str) -> GeneratedPost:
        user_prompt = Prompts.get_post_user_prompt(user_topic)
        
        raw_response = await self.llm.generate_completion(Prompts.POST_SYSTEM, user_prompt)
        json_str = self.cleaner.extract_json_block(raw_response)
        
        try:
            post = GeneratedPost.model_validate_json(json_str)
            
            post.body = Sanitizer.clean_post_html(post.body)
            
            return post

        except ValidationError as e:
            self.logger.error(f"Schema Validation Failed: {e.json()}")
            raise DataParsingError("AI response failed schema validation") from e
        except Exception as e:
            self.logger.exception("Unexpected error during post generation")
            raise AIServiceException("An unexpected error occurred during post generation") from e