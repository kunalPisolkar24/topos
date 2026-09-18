"""Backward-compat shim — prefer src.application.use_cases.SeedUseCase."""

from src.application.use_cases import SeedUseCase, Seeder  # noqa: F401

__all__ = ["Seeder", "SeedUseCase"]
