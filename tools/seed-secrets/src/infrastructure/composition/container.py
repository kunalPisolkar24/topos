"""Composition root — single place that wires dependencies."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

from src.application.use_cases import SeedUseCase
from src.infrastructure.config.settings import Settings
from src.infrastructure.filesystem.env_loader import LocalEnvLoader
from src.infrastructure.secrets_manager import Boto3ParameterStore, Boto3SecretsManager, HybridStore
from src.interfaces.env_loader import IEnvLoader
from src.interfaces.secrets_store import ISecretsStore


def build_env_loader(repo_root: Path | None = None) -> IEnvLoader:
    return LocalEnvLoader(repo_root=repo_root)


def build_secrets_store(
    settings: Settings,
    *,
    endpoint_url: str | None = None,
    region: str | None = None,
    client: Any | None = None,
    client_factory: Any | None = None,
) -> ISecretsStore:
    region_val = region or settings.region
    endpoint_val = endpoint_url if endpoint_url is not None else settings.endpoint_url
    # If a pre-built store was injected (unit tests with FakeStore), use it directly
    if client is not None:
        from src.interfaces.secrets_store import ISecretsStore as _IS

        if isinstance(client, _IS):
            return client
    # Otherwise client is a boto3 client mock or None — share same mock for both SSM and SM
    ssm = Boto3ParameterStore(region=region_val, endpoint_url=endpoint_val, client=client, client_factory=client_factory)
    sm = Boto3SecretsManager(region=region_val, endpoint_url=endpoint_val, client=client, client_factory=client_factory)
    return HybridStore(ssm=ssm, sm=sm)


def build_seeder(
    settings: Settings,
    *,
    endpoint_url: str | None = None,
    region: str | None = None,
    client: Any | None = None,
    client_factory: Any | None = None,
    key_gen: Callable[[int], str] | None = None,
    repo_root: Path | None = None,
) -> tuple[SeedUseCase, IEnvLoader]:
    store = build_secrets_store(
        settings, endpoint_url=endpoint_url, region=region, client=client, client_factory=client_factory
    )
    loader = build_env_loader(repo_root=repo_root)
    seeder = SeedUseCase(store=store, key_gen=key_gen)
    return seeder, loader
