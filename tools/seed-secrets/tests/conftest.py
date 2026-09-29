"""Shared fixtures for seed-secrets tests."""

from __future__ import annotations

import pytest

from src.infrastructure.config.provider import clear_settings_cache


@pytest.fixture(autouse=True)
def _clear_settings_between_tests() -> None:
    clear_settings_cache()
    yield
    clear_settings_cache()
