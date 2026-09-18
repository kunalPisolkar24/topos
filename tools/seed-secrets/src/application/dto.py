"""Application DTOs — inputs/outputs of use-cases."""

from __future__ import annotations

from dataclasses import dataclass

from src.domain.schemas import SeedConfig

# For parity with model-publisher's PublishCommand, expose alias.
SeedCommand = SeedConfig


@dataclass(frozen=True)
class SeedResult:
    results: list[tuple[str, str]]
    generated: list[str]
    config: SeedConfig
