import json
import logging
from typing import List
from src.core.interfaces.llm_provider import LLMProvider
from src.utils.text_cleaner import TextCleaner
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
        
        prompt = (
            "You are a concise editor. Summarize the provided text in exactly 3 clear sentences. "
            "Focus on the main idea and key takeaways."
        )
        return await self.llm.generate_completion(prompt, clean_text)

    async def generate_tags(self, title: str, body: str) -> List[str]:
        clean_body = self.cleaner.clean_html(body)
        content = f"Title: {title}\nBody: {clean_body[:3000]}"
        
        prompt = (
            "You are an SEO specialist. Analyze the content and extract 5-7 highly relevant, high-traffic keywords or tags. "
            "Return ONLY a raw JSON array of strings. Example: [\"technology\", \"innovation\"]. "
            "Do not include any explanation or markdown formatting."
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

    async def generate_post(self, user_topic: str) -> GeneratedPost:
        system_prompt = (
            "You are an expert, versatile content creator capable of writing high-quality, engaging blog posts on any topic (Tech, Lifestyle, Health, Business, etc.). "
            "Your goal is to produce a structured, professional article formatted for a rich-text editor (React Quill).\n\n"
            "STRICT OUTPUT RULES:\n"
            "1. Return ONLY a valid JSON object. No markdown formatting (```json) surrounding the response.\n"
            "2. The JSON must contain exactly these keys: 'title', 'body', 'summary', 'tags'.\n"
            "3. 'body': Must be a raw HTML string. Use <h2> for section headers, <p> for paragraphs, <ul>/<li> for lists, and <strong> for emphasis. "
            "Do NOT use Markdown syntax (e.g., ##, **) in the body. Do NOT include <html>, <head>, or <body> tags.\n"
            "4. 'tags': An array of 5-7 relevant strings.\n"
            "5. Ensure all double quotes inside the HTML content are properly escaped to maintain valid JSON syntax."
        )

        user_prompt = (
            f"Write a comprehensive blog post about: '{user_topic}'.\n"
            "Structure:\n"
            "- Catchy, SEO-optimized Title.\n"
            "- Engaging Introduction.\n"
            "- 3-4 Detailed Subsections (use <h2>).\n"
            "- Conclusion.\n"
            "Ensure the tone is professional yet accessible."
        )
        
        raw_response = await self.llm.generate_completion(system_prompt, user_prompt)
        json_str = self.cleaner.extract_json_block(raw_response)
        
        try:
            data = json.loads(json_str)
            
            required_keys = {"title", "body", "summary", "tags"}
            if not required_keys.issubset(data.keys()):
                raise ValueError(f"Missing keys: {required_keys - data.keys()}")

            return GeneratedPost(
                title=str(data.get("title", "Untitled")),
                body=str(data.get("body", "")),
                summary=str(data.get("summary", "")),
                tags=[str(t) for t in data.get("tags", [])]
            )

        except json.JSONDecodeError as e:
            self.logger.error(f"JSON Decode Error in Post Generation: {e}. Raw Content: {raw_response[:500]}...")
            raise DataParsingError("AI generated invalid JSON structure.")
        except ValueError as e:
            self.logger.error(f"Validation Error in Post Generation: {e}")
            raise DataParsingError("AI response missing required fields.")
        except Exception as e:
            self.logger.error(f"Unexpected error in Post Generation: {e}")
            raise AIServiceException("An unexpected error occurred during post generation.")