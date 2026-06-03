import httpx
import logging
import time
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception
from src.config.settings import settings
from src.core.interfaces.llm_provider import LLMProvider
from src.core.exceptions import LLMProviderError, RateLimitError
from src.infrastructure.monitoring.metrics import (
    LLM_PROVIDER_LATENCY,
    LLM_TOKEN_ERROR_COUNT,
    CIRCUIT_BREAKER_STATE,
    CIRCUIT_BREAKER_REJECTED,
)
from src.infrastructure.llm.circuit_breaker import CircuitBreaker

_STATE_MAP = {"closed": 0, "half-open": 1, "open": 2}

def _is_retryable(exception: BaseException) -> bool:
    if isinstance(exception, httpx.RequestError):
        return True
    if isinstance(exception, httpx.HTTPStatusError):
        return exception.response.status_code >= 500
    return False


def _parse_retry_after(raw: str | None) -> int | None:
    if raw is None:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def _log_retry(retry_state):
    logger = logging.getLogger(__name__)
    logger.warning(
        "LLM request failed, retrying",
        extra={
            "attempt": retry_state.attempt_number,
            "error": str(retry_state.outcome.exception()) if retry_state.outcome else None,
        }
    )

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
        self._cb = CircuitBreaker()
        try:
            self._gauge_task = asyncio.get_running_loop().create_task(self._update_gauge_loop())
        except RuntimeError:
            self._gauge_task = None

    async def is_healthy(self) -> bool:
        if self._cb.is_rate_limited:
            return False
        return await self._cb.can_proceed()

    async def close(self):
        if self._gauge_task is not None:
            self._gauge_task.cancel()
            try:
                await self._gauge_task
            except asyncio.CancelledError:
                pass

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(_is_retryable),
        before_sleep=_log_retry,
        reraise=True
    )
    
    async def _make_request(self, payload: dict) -> dict:
        response = await self.client.post(
            self.url,
            headers=self.headers,
            json=payload
        )
        response.raise_for_status()
        return response.json()

    async def _update_gauge_loop(self):
        while True:
            try:
                await asyncio.sleep(5)
                CIRCUIT_BREAKER_STATE.labels(provider="lightning").set(_STATE_MAP[self._cb.state])
            except asyncio.CancelledError:
                return

    async def generate_completion(self, system_prompt: str, user_content: str) -> str:
        if not await self._cb.can_proceed():
            CIRCUIT_BREAKER_REJECTED.labels(provider="lightning").inc()
            if self._cb.is_rate_limited:
                raise RateLimitError("AI provider rate limit exceeded")
            raise LLMProviderError("AI provider is currently unavailable (circuit breaker open)")

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
        record_latency = True
        try:
            data = await self._make_request(payload)
            await self._cb.record_success()
            return data['choices'][0]['message']['content']

        except asyncio.CancelledError:
            record_latency = False
            self.logger.warning("LLM request cancelled by client")
            raise

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                retry_after = _parse_retry_after(e.response.headers.get("Retry-After"))
                await self._cb.record_rate_limit(retry_after)
                LLM_TOKEN_ERROR_COUNT.labels(provider="lightning", error_type="rate_limit").inc()
                self.logger.warning("Provider rate limited", extra={"retry_after": retry_after})
                raise RateLimitError("AI provider rate limit exceeded", retry_after=retry_after) from e
            await self._cb.record_failure()
            LLM_TOKEN_ERROR_COUNT.labels(provider="lightning", error_type="http_status").inc()
            self.logger.error(f"Provider returned status {e.response.status_code}", extra={"status_code": e.response.status_code})
            raise LLMProviderError(f"Provider returned {e.response.status_code}") from e

        except httpx.RequestError as e:
            await self._cb.record_failure()
            LLM_TOKEN_ERROR_COUNT.labels(provider="lightning", error_type="network").inc()
            self.logger.error(f"Network error communicating with provider: {str(e)}")
            raise LLMProviderError("Failed to communicate with AI provider") from e

        except (KeyError, IndexError, TypeError) as e:
            await self._cb.record_failure()
            LLM_TOKEN_ERROR_COUNT.labels(provider="lightning", error_type="parsing").inc()
            self.logger.error(f"Unexpected response structure: {str(e)}")
            raise LLMProviderError("Invalid response format from provider") from e

        finally:
            if record_latency:
                duration = time.perf_counter() - start_time
                LLM_PROVIDER_LATENCY.labels(provider="lightning", endpoint="chat/completions").observe(duration)