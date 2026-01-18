import httpx
import logging
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from src.config.settings import settings
from src.core.interfaces.llm_provider import LLMProvider
from src.core.exceptions import LLMProviderError

class LightningClient(LLMProvider):
    def __init__(self, http_client: httpx.AsyncClient):
        self.client = http_client
        self.url = settings.LIGHTNING_AI_URL
        self.headers = {
            "Authorization": f"Bearer {settings.LIGHTNING_AI_API_KEY}",
            "Content-Type": "application/json"
        }
        self.model = settings.LIGHTNING_MODEL
        self.logger = logging.getLogger(__name__)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError))
    )
    async def generate_completion(self, system_prompt: str, user_content: str) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.7,
            "max_tokens": 2048
        }

        try:
            response = await self.client.post(
                self.url,
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            return data['choices'][0]['message']['content']
        except httpx.HTTPStatusError as e:
            self.logger.error(f"Provider returned status {e.response.status_code}: {e.response.text}")
            raise LLMProviderError(f"Provider returned {e.response.status_code}")
        except httpx.RequestError as e:
            self.logger.error(f"Network error communicating with provider: {str(e)}")
            raise LLMProviderError("Failed to communicate with AI provider")
        except (KeyError, IndexError) as e:
            self.logger.error(f"Unexpected response structure: {str(e)}")
            raise LLMProviderError("Invalid response format from provider")