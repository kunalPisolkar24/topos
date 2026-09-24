"""Checkpointer factory: in-memory for tests, Postgres for real runs.

The chat graphs use LangGraph checkpointing to persist conversation
state per thread. The backend is env-driven via CHECKPOINT_DB_URL: an
empty URL keeps everything in memory (unit tests, docker-free dev),
a URL selects the durable AsyncPostgresSaver.

CHECKPOINT_DB_URL is the pooled runtime URL (RDS Proxy in prod).
CHECKPOINT_DB_URL_MIGRATE is the direct writer URL used only for
saver.setup() (DDL, including CREATE INDEX CONCURRENTLY, which cannot
run through a pooler); empty falls back to CHECKPOINT_DB_URL.
"""

import logging
import time
from typing import cast

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from src.config import settings
from src.domain.models import RetrievedPost
from src.graphs.state import ChatMessage, RelevanceVerdict, ToolCall
from src.observability import metrics

logger = logging.getLogger(__name__)

# Timeout for opening the runtime pool; the startup retry loop in main
# (_ensure_checkpointer_ready) handles transient Postgres/proxy blips.
POOL_OPEN_TIMEOUT_SECONDS = 30.0

# Every custom dataclass stored in ChatState channels must be explicitly
# allowed; anything missing is silently degraded to a raw dict when a
# checkpoint is reloaded (and will be hard-blocked by langgraph's strict
# msgpack mode in a future release).
_SERDE = JsonPlusSerializer(
    allowed_msgpack_modules={
        ChatMessage,
        RelevanceVerdict,
        RetrievedPost,
        ToolCall,
    }
)


def setup_conninfo() -> str:
    """Direct writer URL for saver.setup(). Falls back to the pooled URL."""
    return settings.CHECKPOINT_DB_URL_MIGRATE or settings.CHECKPOINT_DB_URL


def build_checkpointer() -> BaseCheckpointSaver:
    if not settings.CHECKPOINT_DB_URL:
        logger.info("checkpoint store: in-memory")
        return InMemorySaver(serde=_SERDE)

    pool = AsyncConnectionPool(
        conninfo=settings.CHECKPOINT_DB_URL,
        min_size=settings.CHECKPOINT_POOL_MIN_SIZE,
        max_size=settings.CHECKPOINT_POOL_MAX_SIZE,
        # Mirror how the saver configures its own connections
        # (from_conn_string): autocommit is required because setup()
        # runs CREATE INDEX CONCURRENTLY, which cannot run inside a
        # transaction block. prepare_threshold=0 keeps statements unnamed
        # so RDS Proxy sessions never pin.
        kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
        # Opened explicitly by start_checkpointer so connection failures
        # surface inside the startup retry loop.
        open=False,
    )
    logger.info("checkpoint store: postgres")
    return AsyncPostgresSaver(pool, serde=_SERDE)


async def start_checkpointer(saver: BaseCheckpointSaver) -> None:
    """Open the backing pool and create tables. No-op for in-memory.

    DDL runs on the direct writer URL (CHECKPOINT_DB_URL_MIGRATE, or the
    pooled URL when unset); the runtime pool itself is always the pooled
    URL from build_checkpointer. setup() is idempotent, so retry-loop
    re-runs are safe.
    """
    if not isinstance(saver, AsyncPostgresSaver):
        return
    start = time.perf_counter()
    pool = cast(AsyncConnectionPool, saver.conn)
    try:
        migrate_url = setup_conninfo()
        if migrate_url != settings.CHECKPOINT_DB_URL:
            migrate_pool = AsyncConnectionPool(
                conninfo=migrate_url,
                min_size=1,
                max_size=1,
                kwargs={
                    "autocommit": True,
                    "prepare_threshold": 0,
                    "row_factory": dict_row,
                },
                open=False,
            )
            try:
                await migrate_pool.open(wait=True, timeout=POOL_OPEN_TIMEOUT_SECONDS)
                await AsyncPostgresSaver(migrate_pool, serde=_SERDE).setup()
            finally:
                await migrate_pool.close()
            await pool.open(wait=True, timeout=POOL_OPEN_TIMEOUT_SECONDS)
        else:
            await pool.open(wait=True, timeout=POOL_OPEN_TIMEOUT_SECONDS)
            await saver.setup()
    except Exception:
        metrics.DEPENDENCY_UP.labels(dep="checkpoint").set(0)
        raise
    duration = time.perf_counter() - start
    metrics.DEPENDENCY_UP.labels(dep="checkpoint").set(1)
    metrics.DEPENDENCY_PING_DURATION.labels(dep="checkpoint").observe(duration)


async def close_checkpointer(saver: BaseCheckpointSaver) -> None:
    """Release the backing pool. No-op for in-memory."""
    if not isinstance(saver, AsyncPostgresSaver):
        return
    pool = cast(AsyncConnectionPool, saver.conn)
    await pool.close()
