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


def test_shared_keys_synced() -> None:
    env = {
        "GITHUB_ID": "a",
        "GITHUB_SECRET": "b",
        "PADDLE_API_KEY": "c",
        "PADDLE_WEBHOOK_SECRET": "d",
    }
    store = FakeStore()
    seeder = Seeder(store)
    payloads = seeder.build_payloads(env)
    web = next(p for p in payloads if p.name == "detectai/web/secrets")
    gateway = next(p for p in payloads if p.name == "detectai/gateway/secrets")
    inference = next(p for p in payloads if p.name == "detectai/inference/secrets")
    assert web.data["INTERNAL_API_KEY"] == gateway.data["INTERNAL_API_KEY"]
    assert web.data["AI_SERVICE_API_KEY"] == inference.data["API_KEY"]


def test_real_aws_guard() -> None:
    env = {"GITHUB_ID": "a"}
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


def test_tf_managed_guard() -> None:
    env = {"GITHUB_ID": "a"}
    seeder = Seeder(FakeStore())
    cfg = SeedConfig(env_file="/tmp/x", endpoint_url="http://localhost:4566", only=frozenset({"detectai/pg/urls"}))
    try:
        seeder.seed(cfg, env)
        raise AssertionError("should have raised GuardError")
    except GuardError:
        pass


def test_allowlist_ignores_infra_keys() -> None:
    env = {"GITHUB_ID": "a", "DATABASE_URL": "postgresql://...", "REDIS_URL": "redis://..."}
    seeder = Seeder(FakeStore())
    payloads = seeder.build_payloads(env)
    for p in payloads:
        assert "DATABASE_URL" not in p.data
        assert "REDIS_URL" not in p.data
