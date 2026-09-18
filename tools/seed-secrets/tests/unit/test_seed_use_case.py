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


def _deterministic_gen(nbytes: int) -> str:
    # deterministic for tests: "a" * 2*nbytes, "b" * etc? Use fixed hex-like string
    return "a" * (nbytes * 2)


def test_shared_keys_synced_with_injected_gen() -> None:
    env = {"GITHUB_ID": "a", "GITHUB_SECRET": "b", "PADDLE_API_KEY": "c", "PADDLE_WEBHOOK_SECRET": "d"}
    seeder = SeedUseCase(FakeStore(), key_gen=_deterministic_gen)
    payloads = seeder.build_payloads(env)
    web = next(p for p in payloads if p.name == "detectai/web/secrets")
    gateway = next(p for p in payloads if p.name == "detectai/gateway/secrets")
    inference = next(p for p in payloads if p.name == "detectai/inference/secrets")
    assert web.data["INTERNAL_API_KEY"] == gateway.data["INTERNAL_API_KEY"]
    assert web.data["AI_SERVICE_API_KEY"] == inference.data["API_KEY"]
    # deterministic values
    assert web.data["INTERNAL_API_KEY"] == "a" * 48
    assert web.data["NEXTAUTH_SECRET"] == "a" * 64


def test_injected_key_gen_is_used() -> None:
    calls: list[int] = []

    def gen(n: int) -> str:
        calls.append(n)
        return "x" * (n * 2)

    seeder = SeedUseCase(FakeStore(), key_gen=gen)
    seeder.build_payloads({})
    # Should have generated INTERNAL, AI, NEXTAUTH (and maybe not PADDLE_ENV)
    assert 24 in calls
    assert 32 in calls


def test_dry_run_no_store_calls() -> None:
    env = {"GITHUB_ID": "a"}
    store = FakeStore()
    seeder = SeedUseCase(store, key_gen=_deterministic_gen)
    cfg = SeedConfig(env_file="/tmp/x", endpoint_url="http://localhost:4566", dry_run=True)
    results, generated = seeder.seed(cfg, env)
    assert all(s == "dry-run" for _, s in results)
    assert store.calls == []  # dry-run should not call upsert
    assert "NEXTAUTH_SECRET" in str(generated)


def test_real_aws_guard() -> None:
    env = {"GITHUB_ID": "a"}
    seeder = SeedUseCase(FakeStore(), key_gen=_deterministic_gen)
    cfg = SeedConfig(env_file="/tmp/x", endpoint_url=None, dry_run=False)
    try:
        seeder.seed(cfg, env)
        raise AssertionError("should have raised GuardError")
    except GuardError:
        pass


def test_tf_managed_guard() -> None:
    env = {"GITHUB_ID": "a"}
    seeder = SeedUseCase(FakeStore(), key_gen=_deterministic_gen)
    cfg = SeedConfig(env_file="/tmp/x", endpoint_url="http://localhost:4566", only=frozenset({"detectai/pg/urls"}))
    try:
        seeder.seed(cfg, env)
        raise AssertionError("should have raised GuardError")
    except GuardError:
        pass


def test_unknown_secret_guard() -> None:
    env = {"GITHUB_ID": "a"}
    seeder = SeedUseCase(FakeStore(), key_gen=_deterministic_gen)
    cfg = SeedConfig(env_file="/tmp/x", endpoint_url="http://localhost:4566", only=frozenset({"unknown/secret"}))
    try:
        seeder.seed(cfg, env)
        raise AssertionError("should have raised GuardError")
    except GuardError as e:
        assert "unknown secret" in str(e).lower()


def test_only_filter() -> None:
    env = {"GITHUB_ID": "a", "PADDLE_API_KEY": "x", "PADDLE_WEBHOOK_SECRET": "y"}
    seeder = SeedUseCase(FakeStore(), key_gen=_deterministic_gen)
    payloads = seeder.build_payloads(env, only=frozenset({"detectai/web/secrets"}))
    assert all(p.name == "detectai/web/secrets" for p in payloads)
    assert len(payloads) == 1


def test_execute_alias() -> None:
    env = {"GITHUB_ID": "a"}
    store = FakeStore()
    seeder = SeedUseCase(store, key_gen=_deterministic_gen)
    cfg = SeedConfig(env_file="/tmp/x", endpoint_url="http://localhost:4566", dry_run=True)
    results, _ = seeder.execute(cfg, env)
    assert results
