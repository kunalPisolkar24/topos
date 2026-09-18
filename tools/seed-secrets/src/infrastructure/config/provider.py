"""Lazy cached settings provider for seed-secrets."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from src.infrastructure.config.settings import Settings


def _load_dotenv_if_present() -> None:
    try:
        from dotenv import load_dotenv  # type: ignore
    except ImportError:
        return
    if os.path.exists(".env"):
        load_dotenv(override=False)
    else:
        env_file = os.getenv("ENV_FILE")
        if env_file and os.path.exists(env_file):
            load_dotenv(dotenv_path=env_file, override=False)


def _build_settings() -> Settings:
    _load_dotenv_if_present()
    merged: dict[str, Any] = {k: v for k, v in os.environ.items() if v is not None and v != ""}
    # Map AWS_ENDPOINT_URL -> endpoint_url for Settings (pydantic alias not needed)
    if "AWS_ENDPOINT_URL" in merged and "endpoint_url" not in merged:
        merged["endpoint_url"] = merged["AWS_ENDPOINT_URL"]
    if "AWS_REGION" in merged and "region" not in merged:
        merged["region"] = merged["AWS_REGION"]
    return Settings(**merged)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return _build_settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()
