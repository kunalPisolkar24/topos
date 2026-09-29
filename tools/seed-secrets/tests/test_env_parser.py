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
        'VITE_GRAPHQL_URL="https://example.com/graphql"\n'
        'VITE_CLOUDINARY_CLOUD_NAME= "my-cloud"\n'
        'FRONTEND_CONTAINER="prod-frontend"\n'
    )
    data = parse_env_file(path)
    assert data["VITE_GRAPHQL_URL"] == "https://example.com/graphql"
    assert data["VITE_CLOUDINARY_CLOUD_NAME"] == "my-cloud"
    assert data["FRONTEND_CONTAINER"] == "prod-frontend"


def test_export_and_inline_comment() -> None:
    path = _write(
        "export VITE_ENV_TYPE=prod # inline comment\n"
        'QUOTED_HASH="a#b#c" # comment after quoted\n'
        "UNQUOTED_SPACE=val # comment\n"
    )
    data = parse_env_file(path)
    assert data["VITE_ENV_TYPE"] == "prod"
    assert data["QUOTED_HASH"] == "a#b#c"
    assert data["UNQUOTED_SPACE"] == "val"


def test_empty_values_are_preserved_as_empty() -> None:
    path = _write("VITE_CLOUDINARY_CLOUD_NAME=\nVITE_CLOUDINARY_UPLOAD_PRESET= # empty with comment\n")
    data = parse_env_file(path)
    assert data["VITE_CLOUDINARY_CLOUD_NAME"] == ""
    assert data["VITE_CLOUDINARY_UPLOAD_PRESET"] == ""
