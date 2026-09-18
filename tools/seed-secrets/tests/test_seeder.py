import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.application.seeder import Seeder  # noqa: E402
from src.core.exceptions import GuardError  # noqa: E402
from src.domain.schemas import SeedConfig  # noqa: E402
from src.interfaces.secrets_store import ISecretsStore  # noqa: E402


class FakeStore(ISecretsStore):
    def __init__(self) -> None:
        self.calls: list[str] = []

    def upsert(self, payload, dry_run: bool = False) -> str:  # type: ignore[no-untyped-def]
        self.calls.append(payload.name)
        return "dry-run" if dry_run else "created"

    def list_secrets(self) -> list[str]:
        return []


def test_frontend_payload_built() -> None:
    env = {
        "VITE_GRAPHQL_URL": "https://example.com/graphql",
        "VITE_ENV_TYPE": "prod",
        "APP_NETWORK": "topos_network",
    }
    store = FakeStore()
    seeder = Seeder(store)
    payloads = seeder.build_payloads(env)
    assert len(payloads) == 1
    p = payloads[0]
    assert p.name == "/topos/frontend/config"
    assert p.data["VITE_GRAPHQL_URL"] == "https://example.com/graphql"


def test_real_aws_guard() -> None:
    env = {"VITE_GRAPHQL_URL": "https://example.com/graphql"}
    seeder = Seeder(FakeStore())
    cfg = SeedConfig(env_file="/tmp/x", endpoint_url=None, dry_run=False)
    try:
        seeder.seed(cfg, env)
        raise AssertionError("should have raised GuardError")
    except GuardError:
        pass
    # dry-run bypasses guard
    cfg_dry = SeedConfig(env_file="/tmp/x", endpoint_url=None, dry_run=True)
    results, _ = seeder.seed(cfg_dry, env)
    assert all(s == "dry-run" for _, s in results)


def test_unknown_secret_guard() -> None:
    env = {"VITE_GRAPHQL_URL": "https://example.com/graphql"}
    seeder = Seeder(FakeStore())
    cfg = SeedConfig(env_file="/tmp/x", endpoint_url="http://localhost:4566", only=frozenset({"unknown/secret"}))
    try:
        seeder.seed(cfg, env)
        raise AssertionError("should have raised GuardError")
    except GuardError as e:
        assert "unknown secret" in str(e).lower()


def test_allowlist_ignores_infra_keys() -> None:
    env = {"VITE_GRAPHQL_URL": "https://example.com/graphql", "DATABASE_URL": "postgresql://...", "REDIS_URL": "redis://..."}
    seeder = Seeder(FakeStore())
    payloads = seeder.build_payloads(env)
    for p in payloads:
        assert "DATABASE_URL" not in p.data
        assert "REDIS_URL" not in p.data
