from __future__ import annotations

from pathlib import Path

import pytest

from src.core.exceptions import EnvParseError
from src.infrastructure.filesystem.env_loader import LocalEnvLoader


@pytest.mark.integration
def test_loader_reads_real_file(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text('GITHUB_ID="abc"\nGOOGLE_SECRET= "xyz"  # comment\n', encoding="utf-8")
    loader = LocalEnvLoader(repo_root=tmp_path)
    data = loader.load(env_file)
    assert data["GITHUB_ID"] == "abc"
    assert data["GOOGLE_SECRET"] == "xyz"


@pytest.mark.integration
def test_loader_export_and_quoted_hash(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        'export PADDLE_ENVIRONMENT=sandbox # inline\nQUOTED_HASH="a#b#c" # comment\n',
        encoding="utf-8",
    )
    loader = LocalEnvLoader(repo_root=tmp_path)
    data = loader.load(env_file)
    assert data["PADDLE_ENVIRONMENT"] == "sandbox"
    assert data["QUOTED_HASH"] == "a#b#c"


@pytest.mark.integration
def test_loader_raises_for_missing() -> None:
    loader = LocalEnvLoader(repo_root=Path("/tmp"))
    with pytest.raises(EnvParseError):
        loader.load("/nonexistent/path/.env.missing.12345")


@pytest.mark.integration
def test_loader_resolves_relative_to_repo_root(tmp_path: Path) -> None:
    # Create repo-like structure: tmp_path/infra/docker/prod/.env
    prod_env = tmp_path / "infra" / "docker" / "prod" / ".env"
    prod_env.parent.mkdir(parents=True)
    prod_env.write_text("GITHUB_ID=from_repo_root\n", encoding="utf-8")
    loader = LocalEnvLoader(repo_root=tmp_path)
    # Pass relative path that exists only relative to repo_root
    data = loader.load("infra/docker/prod/.env")
    assert data["GITHUB_ID"] == "from_repo_root"
    # resolve_path should give absolute repo_root path
    resolved = loader.resolve_path("infra/docker/prod/.env")
    assert resolved == (tmp_path / "infra/docker/prod/.env").resolve()


@pytest.mark.integration
def test_pure_parser_content() -> None:
    from src.application.env_parser import parse_env_content

    data = parse_env_content('A="1"\nB=2 # comment\n')
    assert data["A"] == "1"
    assert data["B"] == "2"
