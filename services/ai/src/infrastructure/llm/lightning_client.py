import httpx
import logging
from src.config.settings import settings
from src.core.interfaces.llm_provider.py import LLMProvider
from src.core.exceptions import LLMProviderError

class LightningClient(LLMProvider):
    def __init__(self):
        self.url = settings.LIGHTNING_AI_URL
        self.headers = {
            "Authorization": f"Bearer {settings.LIGHTNING_AI_API_KEY}",
            "Content-Type": "application/json"
        }
        self.model = settings.LIGHTNING_MODEL
        self.timeout = settings.TIMEOUT_SECONDS
        self.logger = logging.getLogger(__name__)

    async def generate_completion(self, system_prompt: str, user_content: str) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.7,
            "max_tokens": 1024
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.url, 
                    headers=self.headers, 
                    json=payload, 
                    timeout=self.timeout
                )
                response.raise_for_status()
                data = response.json()
                return data['choices'][0]['message']['content']
            except httpx.HTTPStatusError as e:
                self.logger.error(f"HTTP error: {e.response.text}")
                raise LLMProviderError(f"Provider returned {e.response.status_code}")
            except (httpx.RequestError, KeyError, IndexError) as e:
                self.logger.error(f"Request failed: {str(e)}")
                raise LLMProviderError("Failed to communicate with AI provider")