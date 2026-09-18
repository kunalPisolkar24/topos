"""Minimal structured logging — never logs secret values."""

from __future__ import annotations

import logging
import sys

_REDACTED = "***"


def configure_logging(*, verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
        stream=sys.stdout,
    )


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def redact(value: str | None) -> str:
    if not value:
        return _REDACTED
    if len(value) <= 4:
        return _REDACTED
    return f"{value[:2]}***{value[-2:]}"
