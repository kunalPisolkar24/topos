"""Filesystem env loader — the only place that touches Path.exists/open for env files."""

from __future__ import annotations

from pathlib import Path

from src.application.env_parser import parse_env_content
from src.core.exceptions import EnvParseError
from src.interfaces.env_loader import IEnvLoader


class LocalEnvLoader(IEnvLoader):
    def __init__(self, repo_root: Path | None = None) -> None:
        # repo_root = parent of tools/seed-secrets -> repo root
        if repo_root is None:
            # env_loader.py is at tools/seed-secrets/src/infrastructure/filesystem/env_loader.py
            # parents[5] == repo root (topos)
            repo_root = Path(__file__).resolve().parents[5]
        self._repo_root = Path(repo_root).resolve()

    def resolve_path(self, raw_path: str | Path) -> Path:
        p = Path(raw_path)
        if p.is_absolute():
            return p
        if p.exists():
            return p
        alt = self._repo_root / p
        if alt.exists():
            return alt
        return p

    def load(self, path: str | Path) -> dict[str, str]:
        resolved = self.resolve_path(path)
        if not resolved.exists():
            raise EnvParseError(f"env file not found: {resolved}", path=str(resolved))
        try:
            text = resolved.read_text(encoding="utf-8")
        except Exception as e:
            raise EnvParseError(f"failed to read env file {resolved}: {e}", path=str(resolved)) from e
        return parse_env_content(text)
