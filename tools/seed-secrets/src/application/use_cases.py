"""Use-case — seed secrets from env dict into Secrets Manager."""

from __future__ import annotations

import secrets
from collections.abc import Callable

from src.core.exceptions import GuardError
from src.domain.constants import (
    API_KEY_FALLBACK,
    APP_SECRETS,
    DEFAULT_PADDLE_ENV,
    SECRET_KEY_MAP,
    TF_MANAGED_SECRETS,
)
from src.domain.schemas import SecretPayload, SeedConfig
from src.interfaces.secrets_store import ISecretsStore


def _default_key_gen(nbytes: int) -> str:
    return secrets.token_hex(nbytes)


class SeedUseCase:
    """Orchestrates payload building and guarded writes."""

    def __init__(
        self,
        store: ISecretsStore,
        key_gen: Callable[[int], str] | None = None,
    ) -> None:
        self.store = store
        self._key_gen: Callable[[int], str] = key_gen or _default_key_gen

    def _generate_hex(self, nbytes: int) -> str:
        return self._key_gen(nbytes)

    def build_payloads(self, env: dict[str, str], only: frozenset[str] | None = None) -> list[SecretPayload]:
        """Build per-secret payloads from parsed env dict.

        - Only keys in allowlist are considered.
        - Empty values are skipped.
        - Shared keys are generated once if missing (only if any target secret needs them).
        """
        present: dict[str, str] = {k: v for k, v in env.items() if v != ""}

        # Determine which keys are actually needed by the target secrets (frontend or legacy)
        needed_keys: set[str] = set()
        for secret_name, keys in SECRET_KEY_MAP.items():
            if only and secret_name not in only:
                continue
            needed_keys.update(keys)

        if "INTERNAL_API_KEY" in needed_keys:
            internal = present.get("INTERNAL_API_KEY", "")
            if not internal:
                internal = self._generate_hex(24)
                present["INTERNAL_API_KEY"] = internal

        if "AI_SERVICE_API_KEY" in needed_keys or "API_KEY" in needed_keys:
            ai_key = present.get("AI_SERVICE_API_KEY", "") or present.get(API_KEY_FALLBACK, "")
            if not ai_key:
                ai_key = present.get("API_KEY", "")
            if not ai_key:
                if "AI_SERVICE_API_KEY" in needed_keys or "API_KEY" in needed_keys:
                    ai_key = self._generate_hex(24)
                    present["AI_SERVICE_API_KEY"] = ai_key
                    present["API_KEY"] = ai_key
            else:
                if "AI_SERVICE_API_KEY" in needed_keys:
                    present.setdefault("AI_SERVICE_API_KEY", ai_key)
                if "API_KEY" in needed_keys:
                    present.setdefault("API_KEY", ai_key)

        if "NEXTAUTH_SECRET" in needed_keys and not present.get("NEXTAUTH_SECRET"):
            present["NEXTAUTH_SECRET"] = self._generate_hex(32)

        if "PADDLE_API_KEY" in needed_keys and "PADDLE_API_KEY" in present and not present.get("PADDLE_ENVIRONMENT"):
            present["PADDLE_ENVIRONMENT"] = DEFAULT_PADDLE_ENV

        payloads: list[SecretPayload] = []
        for secret_name, keys in SECRET_KEY_MAP.items():
            if only and secret_name not in only:
                continue
            data: dict[str, str] = {}
            for k in keys:
                v = present.get(k, "")
                if v != "":
                    data[k] = v
            if not data:
                continue
            payloads.append(SecretPayload(name=secret_name, data=data))

        return payloads

    def execute(self, config: SeedConfig, env: dict[str, str]) -> tuple[list[tuple[str, str]], list[str]]:
        """Alias for seed — mirrors model-publisher's execute(cmd)."""
        return self.seed(config, env)

    def seed(
        self, config: SeedConfig, env: dict[str, str]
    ) -> tuple[list[tuple[str, str]], list[str]]:
        """Execute seeding. Returns (results, generated_keys)."""
        if config.only:
            for name in config.only:
                if name in TF_MANAGED_SECRETS and not config.force:
                    raise GuardError(f"refusing to touch TF-managed secret {name} without --force")
                if name not in APP_SECRETS and name not in TF_MANAGED_SECRETS:
                    raise GuardError(f"unknown secret {name}")

        if config.is_real_aws and not config.confirm_prod and not config.dry_run:
            raise GuardError(
                "refusing to write to real AWS without --confirm-prod (or use --dry-run to preview)"
            )

        original_keys = set(k for k, v in env.items() if v != "")

        payloads = self.build_payloads(env, only=config.only)

        # Determine needed keys for reporting (only report generated keys that were actually needed)
        needed_for_report: set[str] = set()
        for secret_name, keys in SECRET_KEY_MAP.items():
            if config.only and secret_name not in config.only:
                continue
            needed_for_report.update(keys)

        generated: list[str] = []
        if "INTERNAL_API_KEY" in needed_for_report and "INTERNAL_API_KEY" not in original_keys:
            generated.append("INTERNAL_API_KEY (synced to web + gateway)")
        if ("AI_SERVICE_API_KEY" in needed_for_report or "API_KEY" in needed_for_report) and "AI_SERVICE_API_KEY" not in original_keys and "API_KEY" not in original_keys:
            generated.append("AI_SERVICE_API_KEY/API_KEY (synced to web + inference)")
        if "NEXTAUTH_SECRET" in needed_for_report and "NEXTAUTH_SECRET" not in original_keys:
            generated.append("NEXTAUTH_SECRET")

        results: list[tuple[str, str]] = []
        for p in payloads:
            if p.name in TF_MANAGED_SECRETS and not config.force:
                raise GuardError(f"refusing to touch TF-managed secret {p.name} without --force")
            if config.dry_run:
                results.append((p.name, "dry-run"))
                continue
            status = self.store.upsert(p, dry_run=False)
            results.append((p.name, status))
        return results, generated


# Backward-compat alias: original class name
Seeder = SeedUseCase
