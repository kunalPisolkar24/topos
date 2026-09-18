from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.domain.schemas import SecretPayload, SeedConfig


def test_seed_config_defaults() -> None:
    cfg = SeedConfig(env_file="infra/docker/prod/.env", endpoint_url="http://localhost:4566")
    assert cfg.region == "ap-south-1"
    assert cfg.dry_run is False
    assert cfg.only is None
    assert cfg.is_real_aws is False


def test_seed_config_real_aws_detection() -> None:
    cfg = SeedConfig(env_file="x", endpoint_url=None)
    assert cfg.is_real_aws is True
    cfg2 = SeedConfig(env_file="x", endpoint_url="")
    assert cfg2.is_real_aws is True
    assert cfg2.endpoint_url is None
    cfg3 = SeedConfig(env_file="x", endpoint_url="http://localhost:4566")
    assert cfg3.is_real_aws is False


def test_seed_config_validates_env_file() -> None:
    with pytest.raises(ValidationError):
        SeedConfig(env_file="", endpoint_url=None)
    with pytest.raises(ValidationError):
        SeedConfig(env_file="   ", endpoint_url=None)


def test_seed_config_parses_only_string() -> None:
    cfg = SeedConfig(env_file="x", endpoint_url=None, only="detectai/web/secrets, detectai/gateway/secrets")
    assert cfg.only == frozenset({"detectai/web/secrets", "detectai/gateway/secrets"})


def test_seed_config_parses_only_frozenset() -> None:
    cfg = SeedConfig(env_file="x", endpoint_url=None, only=frozenset({"a", "b"}))
    assert cfg.only == frozenset({"a", "b"})


def test_seed_config_empty_only_becomes_none() -> None:
    cfg = SeedConfig(env_file="x", endpoint_url=None, only="")
    assert cfg.only is None
    cfg2 = SeedConfig(env_file="x", endpoint_url=None, only=frozenset())
    assert cfg2.only is None


def test_seed_config_region_strip() -> None:
    cfg = SeedConfig(env_file="x", endpoint_url=None, region="  ap-south-1  ")
    assert cfg.region == "ap-south-1"


def test_secret_payload_is_empty() -> None:
    p = SecretPayload(name="detectai/web/secrets", data={})
    assert p.is_empty() is True
    p2 = SecretPayload(name="detectai/web/secrets", data={"a": "b"})
    assert p2.is_empty() is False


def test_secret_payload_validates_name() -> None:
    with pytest.raises(ValidationError):
        SecretPayload(name="", data={})
    with pytest.raises(ValidationError):
        SecretPayload(name="   ", data={})


def test_secret_payload_trims_name() -> None:
    p = SecretPayload(name="  detectai/web/secrets  ", data={})
    assert p.name == "detectai/web/secrets"
