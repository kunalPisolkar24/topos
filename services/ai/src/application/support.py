"""Shared transport plumbing for the application use-cases.

Error types, per-RPC metrics/access-log decorators, and the recommend
cold-start gauge live here so every use-case module shares one behavior
for validation, failure mapping, and observability.
"""

import asyncio
import functools
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

import grpc

from src.embeddings import EmbeddingError
from src.llm import LLMError
from src.observability import metrics
from src.observability.tracing import get_span_ids

logger = logging.getLogger(__name__)
access_logger = logging.getLogger("access")

Handler = Callable[..., Awaitable[Any]]
StreamHandler = Callable[..., AsyncIterator[Any]]
AccessFields = Callable[[Any, Any], dict[str, Any]]


class TooLargeError(Exception):
    """Raised when a request exceeds its configured size limit."""

    def __init__(self, limit: int) -> None:
        self.limit = limit


class ValidationError(Exception):
    """Raised when a request is malformed."""

    def __init__(self, message: str) -> None:
        self.message = message


class NotFoundError(Exception):
    """Raised when a referenced workflow or resource does not exist."""

    def __init__(self, message: str) -> None:
        self.message = message


_recommend_calls = 0
_cold_start_calls = 0


def _record_recommend(mode: str, duration: float, cold_start: bool) -> None:
    """Record recommendation metrics for a successful RecommendFeed call.

    cold_start marks an empty feed, i.e. a user with no profile yet; the
    ratio gauge is the cumulative cold-start share since process start.
    """
    global _recommend_calls, _cold_start_calls
    metrics.RECOMMEND_REQUESTS.labels(method=mode, status="OK").inc()
    metrics.RECOMMEND_REQUEST_DURATION.labels(method=mode, status="OK").observe(
        duration
    )
    _recommend_calls += 1
    if cold_start:
        _cold_start_calls += 1
        metrics.RECOMMEND_COLD_START.inc()
    metrics.RECOMMEND_COLD_START_RATIO.set(_cold_start_calls / _recommend_calls)


def _record_rpc(
    method: str,
    status: str,
    start: float,
    extra: dict[str, Any] | None = None,
) -> None:
    duration = time.perf_counter() - start
    metrics.GRPC_REQUESTS.labels(method=method, status=status).inc()
    metrics.GRPC_REQUEST_DURATION.labels(method=method, status=status).observe(duration)
    trace_id, span_id = get_span_ids() or ("-", "-")
    access_logger.info(
        "rpc completed",
        extra={
            "method": method,
            "status": status,
            "duration_ms": round(duration * 1000, 1),
            "trace_id": trace_id,
            "span_id": span_id,
            **(extra or {}),
        },
    )


def rpc_stream_metrics(method: str) -> Callable[[StreamHandler], StreamHandler]:
    """Track metrics and access logs around a server-streaming gRPC method.

    Mirrors rpc_metrics for handlers that yield multiple responses: the
    RPC is recorded when the stream ends, whether it completes, fails, or
    is cancelled by the client.
    """

    def decorator(fn: StreamHandler) -> StreamHandler:
        @functools.wraps(fn)
        async def wrapper(
            self: Any, request: Any, context: grpc.aio.ServicerContext
        ) -> Any:
            start = time.perf_counter()
            status = "OK"
            metrics.GRPC_ACTIVE_REQUESTS.inc()
            try:
                async for item in fn(self, request, context):
                    yield item
            except TooLargeError as exc:
                status = "INVALID_ARGUMENT"
                await context.abort(
                    grpc.StatusCode.INVALID_ARGUMENT,
                    f"Input exceeds the maximum length of {exc.limit} characters",
                )
            except ValidationError as exc:
                status = "INVALID_ARGUMENT"
                await context.abort(grpc.StatusCode.INVALID_ARGUMENT, exc.message)
            except LLMError:
                status = "UNAVAILABLE"
                logger.exception("LLM provider failed")
                await context.abort(
                    grpc.StatusCode.UNAVAILABLE, "LLM provider unavailable"
                )
            except EmbeddingError:
                status = "UNAVAILABLE"
                logger.exception("embedding provider failed")
                await context.abort(
                    grpc.StatusCode.UNAVAILABLE, "Embedding provider unavailable"
                )
            except asyncio.CancelledError:
                status = "CANCELLED"
                raise
            except Exception:
                status = "INTERNAL"
                logger.exception("unexpected error in %s", fn.__name__)
                await context.abort(grpc.StatusCode.INTERNAL, "Internal service error")
            finally:
                metrics.GRPC_ACTIVE_REQUESTS.dec()
                _record_rpc(method, status, start)

        return wrapper

    return decorator


def rpc_metrics(
    method: str, extra_fields: AccessFields | None = None
) -> Callable[[Handler], Handler]:
    """Track metrics and access logs around a gRPC method handler.

    extra_fields maps a completed (request, response) pair to extra
    fields merged into the access log entry; it runs only on success.
    """

    def decorator(fn: Handler) -> Handler:
        @functools.wraps(fn)
        async def wrapper(
            self: Any, request: Any, context: grpc.aio.ServicerContext
        ) -> Any:
            start = time.perf_counter()
            status = "OK"
            metrics.GRPC_ACTIVE_REQUESTS.inc()
            fields: dict[str, Any] | None = None
            try:
                response = await fn(self, request, context)
                if extra_fields is not None:
                    fields = extra_fields(request, response)
                return response
            except TooLargeError as exc:
                status = "INVALID_ARGUMENT"
                await context.abort(
                    grpc.StatusCode.INVALID_ARGUMENT,
                    f"Input exceeds the maximum length of {exc.limit} characters",
                )
            except ValidationError as exc:
                status = "INVALID_ARGUMENT"
                await context.abort(grpc.StatusCode.INVALID_ARGUMENT, exc.message)
            except NotFoundError as exc:
                status = "NOT_FOUND"
                await context.abort(grpc.StatusCode.NOT_FOUND, exc.message)
            except LLMError:
                status = "UNAVAILABLE"
                logger.exception("LLM provider failed")
                await context.abort(
                    grpc.StatusCode.UNAVAILABLE, "LLM provider unavailable"
                )
            except EmbeddingError:
                status = "UNAVAILABLE"
                logger.exception("embedding provider failed")
                await context.abort(
                    grpc.StatusCode.UNAVAILABLE, "Embedding provider unavailable"
                )
            except asyncio.CancelledError:
                status = "CANCELLED"
                raise
            except Exception:
                status = "INTERNAL"
                logger.exception("unexpected error in %s", fn.__name__)
                await context.abort(grpc.StatusCode.INTERNAL, "Internal service error")
            finally:
                metrics.GRPC_ACTIVE_REQUESTS.dec()
                _record_rpc(method, status, start, extra=fields)

        return wrapper

    return decorator
