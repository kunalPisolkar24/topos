from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError

from src.domain.schemas import SeedConfig
from src.infrastructure.composition.container import build_seeder
from src.infrastructure.config.settings import Settings


@pytest.mark.integration
def test_composition_dry_run_no_aws_call(tmp_path) -> None:  # type: ignore[no-untyped-def]
    env_file = tmp_path / ".env"
    env_file.write_text("VITE_GRAPHQL_URL=https://example.com/graphql\nVITE_ENV_TYPE=prod\n", encoding="utf-8")
    settings = Settings(region="ap-south-1", endpoint_url="http://localhost:4566")
    client = MagicMock()
    seeder, loader = build_seeder(settings, client=client)
    cfg = SeedConfig(env_file=str(env_file), endpoint_url="http://localhost:4566", region="ap-south-1", dry_run=True)
    env = loader.load(str(env_file))
    results, generated = seeder.seed(cfg, env)
    assert all(s == "dry-run" for _, s in results)
    # dry-run should not call SSM put
    client.get_parameter.assert_not_called()
    client.put_parameter.assert_not_called()
    client.describe_secret.assert_not_called()


@pytest.mark.integration
def test_composition_real_seed_calls_client(tmp_path) -> None:  # type: ignore[no-untyped-def]
    env_file = tmp_path / ".env"
    env_file.write_text("VITE_GRAPHQL_URL=https://example.com/graphql\n", encoding="utf-8")
    settings = Settings(region="ap-south-1", endpoint_url="http://localhost:4566")
    client = MagicMock()

    def get_param_side_effect(Name):  # type: ignore[no-untyped-def]
        raise ClientError({"Error": {"Code": "ParameterNotFound", "Message": "not found"}}, "GetParameter")

    client.get_parameter.side_effect = get_param_side_effect
    client.put_parameter.return_value = {"Version": 1}
    seeder, loader = build_seeder(settings, client=client)
    cfg = SeedConfig(env_file=str(env_file), endpoint_url="http://localhost:4566", region="ap-south-1", dry_run=False)
    env = loader.load(str(env_file))
    results, _ = seeder.seed(cfg, env)
    assert len(results) > 0
    assert client.put_parameter.call_count >= 1


@pytest.mark.integration
def test_composition_endpoint_override() -> None:
    settings = Settings(region="ap-south-1", endpoint_url="http://localhost:4566")
    client = MagicMock()
    seeder, _ = build_seeder(settings, endpoint_url="http://override:4566", client=client)
    # store should have overridden endpoint
    assert seeder.store.endpoint_url == "http://override:4566"  # type: ignore[attr-defined]
