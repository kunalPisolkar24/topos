from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from src.domain.schemas import SeedConfig
from src.infrastructure.composition.container import build_seeder
from src.infrastructure.config.settings import Settings


@pytest.mark.integration
def test_composition_dry_run_no_aws_call(tmp_path) -> None:  # type: ignore[no-untyped-def]
    env_file = tmp_path / ".env"
    env_file.write_text("GITHUB_ID=a\nGITHUB_SECRET=b\n", encoding="utf-8")
    settings = Settings(region="ap-south-1", endpoint_url="http://localhost:4566")
    client = MagicMock()
    seeder, loader = build_seeder(settings, client=client, key_gen=lambda n: "x" * (n * 2))
    cfg = SeedConfig(env_file=str(env_file), endpoint_url="http://localhost:4566", region="ap-south-1", dry_run=True)
    env = loader.load(str(env_file))
    results, generated = seeder.seed(cfg, env)
    assert all(s == "dry-run" for _, s in results)
    client.describe_secret.assert_not_called()
    client.create_secret.assert_not_called()


@pytest.mark.integration
def test_composition_real_seed_calls_client(tmp_path) -> None:  # type: ignore[no-untyped-def]
    env_file = tmp_path / ".env"
    env_file.write_text("GITHUB_ID=a\nPADDLE_API_KEY=x\n", encoding="utf-8")
    settings = Settings(region="ap-south-1", endpoint_url="http://localhost:4566")
    client = MagicMock()
    client.describe_secret.side_effect = Exception("not found")  # will trigger create via generic fallback? Better mock properly
    # Use proper ClientError mock for not found
    from botocore.exceptions import ClientError

    def describe_side_effect(SecretId):  # type: ignore[no-untyped-def]
        raise ClientError({"Error": {"Code": "ResourceNotFoundException", "Message": "not found"}}, "Describe")

    client.describe_secret.side_effect = describe_side_effect
    client.create_secret.return_value = {"ARN": "arn"}
    seeder, loader = build_seeder(settings, client=client, key_gen=lambda n: "y" * (n * 2))
    cfg = SeedConfig(env_file=str(env_file), endpoint_url="http://localhost:4566", region="ap-south-1", dry_run=False)
    env = loader.load(str(env_file))
    results, _ = seeder.seed(cfg, env)
    # Should have at least web, workers etc (dry-run false so created)
    assert len(results) > 0
    assert client.create_secret.call_count >= 1


@pytest.mark.integration
def test_composition_endpoint_override() -> None:
    settings = Settings(region="ap-south-1", endpoint_url="http://localhost:4566")
    client = MagicMock()
    seeder, _ = build_seeder(settings, endpoint_url="http://override:4566", client=client)
    # store should have overridden endpoint
    assert seeder.store.endpoint_url == "http://override:4566"  # type: ignore[attr-defined]
