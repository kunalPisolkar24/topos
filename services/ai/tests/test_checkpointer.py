import asyncio
from typing import Any

import pytest
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

from src.graphs.checkpointer import (
    build_checkpointer,
    close_checkpointer,
    setup_conninfo,
    start_checkpointer,
)
from src.main import _ensure_checkpointer_ready


@pytest.fixture
def no_db(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("src.config.settings.CHECKPOINT_DB_URL", "")


def test_build_memory_when_no_url(no_db) -> None:
    assert isinstance(build_checkpointer(), InMemorySaver)


async def test_build_postgres_uses_configured_pool_bounds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "src.config.settings.CHECKPOINT_DB_URL",
        "postgresql://ai_checkpointer:pass@localhost:5433/ai_checkpoints",
    )
    monkeypatch.setattr("src.config.settings.CHECKPOINT_DB_URL_MIGRATE", "")
    monkeypatch.setattr("src.config.settings.CHECKPOINT_POOL_MIN_SIZE", 2)
    monkeypatch.setattr("src.config.settings.CHECKPOINT_POOL_MAX_SIZE", 4)
    saver = build_checkpointer()
    try:
        assert isinstance(saver, AsyncPostgresSaver)
        assert saver.conn.min_size == 2
        assert saver.conn.max_size == 4
    finally:
        await saver.conn.close()


def test_setup_conninfo_falls_back_to_pooled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "src.config.settings.CHECKPOINT_DB_URL", "postgresql://pooled/db"
    )
    monkeypatch.setattr("src.config.settings.CHECKPOINT_DB_URL_MIGRATE", "")

    assert setup_conninfo() == "postgresql://pooled/db"


def test_setup_conninfo_prefers_migrate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "src.config.settings.CHECKPOINT_DB_URL", "postgresql://pooled/db"
    )
    monkeypatch.setattr(
        "src.config.settings.CHECKPOINT_DB_URL_MIGRATE", "postgresql://direct/db"
    )

    assert setup_conninfo() == "postgresql://direct/db"


async def test_start_runs_setup_on_migrate_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "src.config.settings.CHECKPOINT_DB_URL", "postgresql://pooled/db"
    )
    monkeypatch.setattr(
        "src.config.settings.CHECKPOINT_DB_URL_MIGRATE", "postgresql://direct/db"
    )
    opened: list[str] = []
    setup_calls: list[str] = []

    class FakeMigratePool:
        def __init__(self, conninfo: str, **kwargs: Any) -> None:
            self.conninfo = conninfo

        async def open(self, wait: bool = True, timeout: float | None = None) -> None:
            opened.append(self.conninfo)

        async def close(self) -> None:
            pass

    async def fake_setup(self: Any) -> None:
        pool = self.conn
        setup_calls.append(
            pool.conninfo if isinstance(pool, FakeMigratePool) else "runtime"
        )

    monkeypatch.setattr("src.graphs.checkpointer.AsyncConnectionPool", FakeMigratePool)
    monkeypatch.setattr(AsyncPostgresSaver, "setup", fake_setup)
    pool = FlakyPool(failures=0)
    saver = _postgres_saver_with(pool)

    await start_checkpointer(saver)

    assert opened == ["postgresql://direct/db"]
    assert setup_calls == ["postgresql://direct/db"]
    assert pool.opens == 1


async def test_build_postgres_when_url_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "src.config.settings.CHECKPOINT_DB_URL",
        "postgresql://ai_checkpointer:pass@localhost:5433/ai_checkpoints",
    )
    saver = build_checkpointer()
    try:
        assert isinstance(saver, AsyncPostgresSaver)
        pool = saver.conn
        assert isinstance(pool, AsyncConnectionPool)
        # Construction must not touch the network; opening is explicit.
        assert pool.closed
    finally:
        await pool.close()


async def test_start_and_close_are_noop_for_memory(no_db) -> None:
    saver = build_checkpointer()
    await start_checkpointer(saver)
    await close_checkpointer(saver)


class FlakyPool:
    """Duck-typed pool whose open() fails until a set number of tries."""

    def __init__(self, failures: int) -> None:
        self.failures = failures
        self.opens = 0
        self.closed = False

    async def open(self, wait: bool = True, timeout: float | None = None) -> None:
        self.opens += 1
        if self.failures > 0:
            self.failures -= 1
            raise ConnectionError("pool not ready")

    async def close(self) -> None:
        self.closed = True


def _postgres_saver_with(pool: Any) -> AsyncPostgresSaver:
    saver = AsyncPostgresSaver(pool)

    async def setup() -> None:
        return None

    saver.setup = setup  # type: ignore[method-assign]
    return saver


async def test_ensure_retries_until_ready(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("src.config.settings.CHECKPOINT_STARTUP_RETRIES", 3)
    monkeypatch.setattr(asyncio, "sleep", _instant_sleep)
    pool = FlakyPool(failures=2)
    saver = _postgres_saver_with(pool)

    await _ensure_checkpointer_ready(saver)

    assert pool.opens == 3


async def test_ensure_raises_after_exhausting_retries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("src.config.settings.CHECKPOINT_STARTUP_RETRIES", 2)
    monkeypatch.setattr(asyncio, "sleep", _instant_sleep)
    pool = FlakyPool(failures=99)
    saver = _postgres_saver_with(pool)

    with pytest.raises(ConnectionError):
        await _ensure_checkpointer_ready(saver)
    assert pool.opens == 2


async def test_close_closes_postgres_pool() -> None:
    pool = FlakyPool(failures=0)
    saver = _postgres_saver_with(pool)

    await close_checkpointer(saver)

    assert pool.closed


def _checkpoint_up() -> float | None:
    from prometheus_client.registry import REGISTRY

    return REGISTRY.get_sample_value("dependency_up", {"dep": "checkpoint"})


def _checkpoint_ping_count() -> float:
    from prometheus_client.registry import REGISTRY

    return (
        REGISTRY.get_sample_value(
            "dependency_ping_duration_seconds_count", {"dep": "checkpoint"}
        )
        or 0.0
    )


async def test_start_marks_checkpoint_up() -> None:
    pool = FlakyPool(failures=0)
    saver = _postgres_saver_with(pool)
    ping_before = _checkpoint_ping_count()

    await start_checkpointer(saver)

    assert _checkpoint_up() == 1.0
    assert _checkpoint_ping_count() == ping_before + 1


async def test_start_marks_checkpoint_down_on_failure() -> None:
    pool = FlakyPool(failures=1)
    saver = _postgres_saver_with(pool)

    with pytest.raises(ConnectionError):
        await start_checkpointer(saver)

    assert _checkpoint_up() == 0.0


async def _instant_sleep(_seconds: float) -> None:
    return None
