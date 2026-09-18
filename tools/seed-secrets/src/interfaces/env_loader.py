"""Port — env file loader (filesystem abstraction)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path


class IEnvLoader(ABC):
    @abstractmethod
    def load(self, path: str | Path) -> dict[str, str]:
        """Load env file at path or raise EnvParseError."""

    @abstractmethod
    def resolve_path(self, raw_path: str | Path) -> Path:
        """Resolve raw_path relative to repo root if needed."""
