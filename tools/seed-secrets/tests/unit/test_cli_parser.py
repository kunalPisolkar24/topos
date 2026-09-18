from __future__ import annotations

import pytest

from src.cli.parser import build_parser, parse_args


def test_parse_minimal() -> None:
    cfg, verbose = parse_args(["--env-file", "infrastructure/docker/prod/.env", "--endpoint-url", "http://localhost:4566"])
    assert cfg.env_file == "infrastructure/docker/prod/.env"
    assert cfg.endpoint_url == "http://localhost:4566"
    assert cfg.region == "ap-south-1"
    assert cfg.dry_run is False
    assert verbose is False


def test_parse_all_flags() -> None:
    cfg, verbose = parse_args(
        [
            "--env-file",
            "my.env",
            "--endpoint-url",
            "",
            "--region",
            "eu-west-1",
            "--dry-run",
            "--only",
            "/topos/frontend/config",
            "--force",
            "--confirm-prod",
            "--verbose",
        ]
    )
    assert cfg.env_file == "my.env"
    assert cfg.endpoint_url is None  # empty -> None = real AWS
    assert cfg.is_real_aws is True
    assert cfg.region == "eu-west-1"
    assert cfg.dry_run is True
    assert cfg.only == frozenset({"/topos/frontend/config"})
    assert cfg.force is True
    assert cfg.confirm_prod is True
    assert verbose is True


def test_parse_only_parsing() -> None:
    cfg, _ = parse_args(["--env-file", "x", "--only", "a,b , c"])
    assert cfg.only == frozenset({"a", "b", "c"})


def test_parse_endpoint_env_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AWS_ENDPOINT_URL", "http://fallback:4566")
    cfg, _ = parse_args(["--env-file", "x"])
    assert cfg.endpoint_url == "http://fallback:4566"


def test_parse_missing_required_env_file_uses_default() -> None:
    cfg, _ = parse_args([])
    assert cfg.env_file == "infrastructure/docker/prod/.env"


def test_build_parser_has_verbose() -> None:
    p = build_parser()
    args = p.parse_args(["--verbose"])
    assert args.verbose is True
