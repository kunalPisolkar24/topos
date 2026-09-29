from __future__ import annotations

import pytest

from src.infrastructure.config.provider import clear_settings_cache, get_settings
from src.infrastructure.config.settings import Settings


def test_settings_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AWS_ENDPOINT_URL", raising=False)
    monkeypatch.delenv("AWS_REGION", raising=False)
    monkeypatch.delenv("ENV_FILE", raising=False)
    clear_settings_cache()
    s = get_settings()
    assert s.region == "ap-south-1"
    assert s.endpoint_url is None


def test_settings_reads_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AWS_ENDPOINT_URL", "http://localhost:4566")
    monkeypatch.setenv("AWS_REGION", "eu-west-1")
    clear_settings_cache()
    s = get_settings()
    assert s.endpoint_url == "http://localhost:4566"
    assert s.region == "eu-west-1"


def test_settings_empty_string_becomes_none(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AWS_ENDPOINT_URL", "")
    clear_settings_cache()
    s = get_settings()
    assert s.endpoint_url is None


def test_settings_direct_construction() -> None:
    s = Settings(region="us-east-1", endpoint_url="http://x:4566")
    assert s.region == "us-east-1"


def test_provider_caches(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AWS_ENDPOINT_URL", "http://a:4566")
    clear_settings_cache()
    a = get_settings()
    b = get_settings()
    assert a is b
    clear_settings_cache()
    c = get_settings()
    assert c is not b
