"""Robust dotenv parser — pure functions, no filesystem except compat shim."""

from __future__ import annotations

import re
from pathlib import Path

from src.core.exceptions import EnvParseError

_KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _strip_inline_comment(value: str) -> str:
    """Remove trailing `# comment` not inside quotes."""
    in_single = False
    in_double = False
    for i, ch in enumerate(value):
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            if i == 0 or value[i - 1] != "\\":
                in_double = not in_double
        elif ch == "#" and not in_single and not in_double:
            if i == 0 or value[i - 1].isspace():
                return value[:i].rstrip()
    return value


def _unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
        inner = value[1:-1]
        if value[0] == '"':
            inner = inner.replace('\\"', '"').replace("\\'", "'").replace("\\\\", "\\")
        return inner
    return value


def parse_env_content(text: str) -> dict[str, str]:
    """Pure parser — takes file content, returns dict.

    Handles: export prefix, quoted values, spaces around '=', inline # comments.
    """
    data: dict[str, str] = {}
    for _lineno, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].lstrip()
            if not line or line.startswith("#"):
                continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key or not _KEY_RE.match(key):
            continue
        if value and not (value.startswith('"') or value.startswith("'")):
            value = _strip_inline_comment(value)
        else:
            if len(value) >= 2 and value[0] in ('"', "'"):
                q = value[0]
                if value.count(q) >= 2:
                    last_q = value.rfind(q)
                    remainder = value[last_q + 1 :].strip()
                    if remainder.startswith("#"):
                        value = value[: last_q + 1]
            value = value.strip()
        value = value.strip()
        value = _unquote(value)
        data[key] = value
    return data


def parse_env_file(path: str | Path) -> dict[str, str]:
    """Backward-compat shim that also touches filesystem.

    New code should use IEnvLoader (infrastructure/filesystem/env_loader.py)
    which delegates to parse_env_content and is the only FS place.
    """
    p = Path(path)
    if not p.exists():
        raise EnvParseError(f"env file not found: {p}", path=str(p))
    try:
        text = p.read_text(encoding="utf-8")
    except Exception as e:
        raise EnvParseError(f"failed to read env file {p}: {e}", path=str(p)) from e
    return parse_env_content(text)
