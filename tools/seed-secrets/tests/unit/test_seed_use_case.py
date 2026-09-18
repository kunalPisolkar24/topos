from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.application.use_cases import SeedUseCase  # noqa: E402
from src.core.exceptions import GuardError  # noqa: E402
from src.domain.schemas import SeedConfig  # noqa: E402
from src.interfaces.secrets_store import ISecretsStore  # noqa: E402


class FakeStore(ISecretsStore):
    def __init__(self) -> None:
        self.calls: list[str] = []
        self.payloads: list = []

    def upsert(self, payload, dry_run: bool = False) -> str:  # type: ignore[no-untyped-def]
        self.calls.append(payload.name)
        self.payloads.append(payload)
        return "dry-run" if dry_run else "created"

    def list_secrets(self) -> list[str]:
        return []


def test_build_payloads_frontend() -> None:
    env = {
        "VITE_GRAPHQL_URL": "https://example.com/graphql",
        "VITE_ENV_TYPE": "prod",
        "FRONTEND_CONTAINER": "prod-frontend",
        "APP_NETWORK": "topos_network",
        "VITE_CLOUDINARY_CLOUD_NAME": "",
    }
    seeder = SeedUseCase(FakeStore())
    payloads = seeder.build_payloads(env)
    assert len(payloads) == 1
    p = payloads[0]
    assert p.name == "/topos/frontend/config"
    assert p.data["VITE_GRAPHQL_URL"] == "https://example.com/graphql"
    assert p.data["VITE_ENV_TYPE"] == "prod"
    assert "VITE_CLOUDINARY_CLOUD_NAME" not in p.data  # empty skipped


def test_build_payloads_empty_skipped() -> None:
    env = {"VITE_GRAPHQL_URL": ""}
    seeder = SeedUseCase(FakeStore())
    payloads = seeder.build_payloads(env)
    assert payloads == []


def test_dry_run_no_store_calls() -> None:
    env = {"VITE_GRAPHQL_URL": "https://example.com/graphql"}
    store = FakeStore()
    seeder = SeedUseCase(store)
    cfg = SeedConfig(env_file="/tmp/x", endpoint_url="http://localhost:4566", dry_run=True)
    results, generated = seeder.seed(cfg, env)
    assert all(s == "dry-run" for _, s in results)
    assert store.calls == []  # dry-run should not call upsert
    assert generated == []


def test_real_aws_guard() -> None:
    env = {"VITE_GRAPHQL_URL": "https://example.com/graphql"}
    seeder = SeedUseCase(FakeStore())
    cfg = SeedConfig(env_file="/tmp/x", endpoint_url=None, dry_run=False)
    try:
        seeder.seed(cfg, env)
        raise AssertionError("should have raised GuardError")
    except GuardError:
        pass


def test_unknown_secret_guard() -> None:
    env = {"VITE_GRAPHQL_URL": "https://example.com/graphql"}
    seeder = SeedUseCase(FakeStore())
    cfg = SeedConfig(env_file="/tmp/x", endpoint_url="http://localhost:4566", only=frozenset({"unknown/secret"}))
    try:
        seeder.seed(cfg, env)
        raise AssertionError("should have raised GuardError")
    except GuardError as e:
        assert "unknown secret" in str(e).lower()


def test_only_filter() -> None:
    env = {"VITE_GRAPHQL_URL": "https://example.com/graphql", "VITE_ENV_TYPE": "prod"}
    seeder = SeedUseCase(FakeStore())
    payloads = seeder.build_payloads(env, only=frozenset({"/topos/frontend/config"}))
    assert all(p.name == "/topos/frontend/config" for p in payloads)
    assert len(payloads) == 1


def test_execute_alias() -> None:
    env = {"VITE_GRAPHQL_URL": "https://example.com/graphql"}
    store = FakeStore()
    seeder = SeedUseCase(store)
    cfg = SeedConfig(env_file="/tmp/x", endpoint_url="http://localhost:4566", dry_run=True)
    results, _ = seeder.execute(cfg, env)
    assert results
