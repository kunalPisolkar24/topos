import asyncio
import logging
import time

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, reset_timeout: float = 30.0):
        self._failure_threshold = failure_threshold
        self._reset_timeout = reset_timeout
        self._state = "closed"
        self._failure_count = 0
        self._last_failure_time = 0.0
        self._lock = asyncio.Lock()
        self._logger = logging.getLogger(__name__)

    @property
    def state(self) -> str:
        return self._state

    async def can_proceed(self) -> bool:
        async with self._lock:
            if self._state == "closed":
                return True
            if self._state == "open":
                if time.monotonic() - self._last_failure_time >= self._reset_timeout:
                    self._state = "half-open"
                    self._logger.info("Circuit breaker transitioning from open to half-open")
                    return True
                return False
            return True

    async def record_success(self):
        async with self._lock:
            if self._state == "half-open":
                self._state = "closed"
                self._failure_count = 0
                self._logger.info("Circuit breaker reset to closed after success in half-open")

    async def record_failure(self):
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.monotonic()
            if self._state == "half-open":
                self._state = "open"
                self._logger.warning("Circuit breaker re-opened after half-open failure")
            elif self._state == "closed" and self._failure_count >= self._failure_threshold:
                self._state = "open"
                self._logger.warning(
                    "Circuit breaker opened after %d consecutive failures",
                    self._failure_count,
                )
