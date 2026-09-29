"""Core exceptions — single hierarchy for seed-secrets."""

from __future__ import annotations


class SeedException(Exception):
    """Base exception for seed-secrets tool."""


class ConfigError(SeedException):
    """Invalid or missing configuration."""


class EnvParseError(SeedException):
    def __init__(self, message: str, *, path: str | None = None) -> None:
        super().__init__(message)
        self.path = path


class SecretsWriteError(SeedException):
    def __init__(self, message: str, *, secret_name: str | None = None) -> None:
        super().__init__(message)
        self.secret_name = secret_name


class GuardError(SeedException):
    """Raised when operation is blocked by safety guard."""
