"""Domain schemas — pure Pydantic, no I/O."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class SeedConfig(BaseModel):
    env_file: str = Field(min_length=1)
    endpoint_url: str | None = Field(default=None)
    region: str = Field(default="ap-south-1", min_length=1)
    dry_run: bool = False
    only: frozenset[str] | None = Field(default=None)
    force: bool = False
    confirm_prod: bool = False

    model_config = {"frozen": True}

    @property
    def is_real_aws(self) -> bool:
        return not self.endpoint_url

    @field_validator("env_file", mode="before")
    @classmethod
    def _validate_env_file(cls, v: Any) -> Any:
        if not isinstance(v, str) or not v.strip():
            raise ValueError("env_file must be non-empty")
        if "\x00" in v:
            raise ValueError("env_file contains null byte")
        return v.strip()

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

    @field_validator("region", mode="before")
    @classmethod
    def _validate_region(cls, v: Any) -> Any:
        if not isinstance(v, str) or not v.strip():
            raise ValueError("region must be non-empty")
        return v.strip()

    @field_validator("only", mode="before")
    @classmethod
    def _validate_only(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, frozenset):
            return v if v else None
        if isinstance(v, (set, list, tuple)):
            # filter empty strings
            cleaned = frozenset(str(s).strip() for s in v if str(s).strip())
            return cleaned if cleaned else None
        if isinstance(v, str):
            if not v.strip():
                return None
            parts = frozenset(p.strip() for p in v.split(",") if p.strip())
            return parts if parts else None
        raise ValueError("only must be frozenset[str] | None")


class SecretPayload(BaseModel):
    name: str = Field(min_length=1)
    data: dict[str, str] = Field(default_factory=dict)

    model_config = {"frozen": False}

    def is_empty(self) -> bool:
        return not self.data

    @field_validator("name", mode="before")
    @classmethod
    def _validate_name(cls, v: Any) -> Any:
        if not isinstance(v, str) or not v.strip():
            raise ValueError("name must be non-empty")
        return v.strip()
