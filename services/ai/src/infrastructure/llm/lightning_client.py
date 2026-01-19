import httpx
import logging
import time
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from src.config.settings import settings
from src.core.interfaces.llm_provider import LLMProvider
from src.core.exceptions import LLMProviderError
from src.infrastructure.monitoring.metrics import LLM_PROVIDER_LATENCY, LLM_TOKEN_ERROR_COUNT

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
        retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError)),
        reraise=True
    )
    
    async def _make_request(self, payload: dict) -> dict:
        """
        Internal method to execute the HTTP request with retry logic.
        Retries ONLY occur on network errors or bad HTTP status codes.
        """
        response = await self.client.post(
            self.url,
            headers=self.headers,
            json=payload
        )
        response.raise_for_status()
        return response.json()

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

        start_time = time.perf_counter()
        try:
            data = await self._make_request(payload)
            return data['choices'][0]['message']['content']

        except asyncio.CancelledError:
            self.logger.warning("LLM request cancelled by client")
            raise

        except httpx.HTTPStatusError as e:
            LLM_TOKEN_ERROR_COUNT.labels(provider="lightning", error_type="http_status").inc()
            self.logger.error(f"Provider returned status {e.response.status_code}", extra={"status_code": e.response.status_code})
            raise LLMProviderError(f"Provider returned {e.response.status_code}") from e

        except httpx.RequestError as e:
            LLM_TOKEN_ERROR_COUNT.labels(provider="lightning", error_type="network").inc()
            self.logger.error(f"Network error communicating with provider: {str(e)}")
            raise LLMProviderError("Failed to communicate with AI provider") from e

        except (KeyError, IndexError, TypeError) as e:
            LLM_TOKEN_ERROR_COUNT.labels(provider="lightning", error_type="parsing").inc()
            self.logger.error(f"Unexpected response structure: {str(e)}")
            raise LLMProviderError("Invalid response format from provider") from e

        finally:
            duration = time.perf_counter() - start_time
            LLM_PROVIDER_LATENCY.labels(provider="lightning", endpoint="chat/completions").observe(duration)