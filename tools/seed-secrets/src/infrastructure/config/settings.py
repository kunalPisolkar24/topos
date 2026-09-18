"""Typed settings for seed-secrets — no I/O here, provider handles loading."""

from __future__ import annotations

from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    region: str = Field(default="ap-south-1")
    endpoint_url: str | None = Field(default=None)
    env_file: str = Field(default="infrastructure/docker/prod/.env")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        env_ignore_empty=True,
    )

    @field_validator("region", mode="before")
    @classmethod
    def _validate_region(cls, v: Any) -> Any:
        if v is None or (isinstance(v, str) and not v.strip()):
            return "ap-south-1"
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("endpoint_url", mode="before")
    @classmethod
    def _validate_endpoint(cls, v: Any) -> Any:
        if v is None or v == "":
            return None
        if isinstance(v, str):
            stripped = v.strip()
            if stripped == "":
                return None
            return stripped
        return v

    @field_validator("env_file", mode="before")
    @classmethod
    def _validate_env_file(cls, v: Any) -> Any:
        if v is None or (isinstance(v, str) and not v.strip()):
            return "infrastructure/docker/prod/.env"
        if isinstance(v, str):
            return v.strip()
        return v
