import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.application.env_parser import parse_env_file  # noqa: E402


def _write(content: str) -> str:
    f = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".env")
    f.write(content)
    f.close()
    return f.name


def test_quoted_and_spaced_values() -> None:
    path = _write(
        'GITHUB_ID="Ov23li9qopShAhV4dTnJ"\n'
        'GOOGLE_SECRET= "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"\n'
        'NEXT_PUBLIC_PADDLE_CLIENT_TOKEN="test_a56b5de2890056c6b9585f65634"\n'
    )
    data = parse_env_file(path)
    assert data["GITHUB_ID"] == "Ov23li9qopShAhV4dTnJ"
    assert data["GOOGLE_SECRET"] == "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"
    assert data["NEXT_PUBLIC_PADDLE_CLIENT_TOKEN"] == "test_a56b5de2890056c6b9585f65634"


def test_export_and_inline_comment() -> None:
    path = _write(
        "export PADDLE_ENVIRONMENT=sandbox # inline comment\n"
        'QUOTED_HASH="a#b#c" # comment after quoted\n'
        "UNQUOTED_SPACE=val # comment\n"
    )
    data = parse_env_file(path)
    assert data["PADDLE_ENVIRONMENT"] == "sandbox"
    assert data["QUOTED_HASH"] == "a#b#c"
    assert data["UNQUOTED_SPACE"] == "val"


def test_empty_values_are_preserved_as_empty() -> None:
    path = _write("NEXTAUTH_SECRET=\nINTERNAL_API_KEY= # empty with comment\n")
    data = parse_env_file(path)
    assert data["NEXTAUTH_SECRET"] == ""
    assert data["INTERNAL_API_KEY"] == ""
