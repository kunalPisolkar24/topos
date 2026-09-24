"""Use-case — seed secrets from env dict into SSM/Secrets Manager."""

from __future__ import annotations

import secrets
from collections.abc import Callable

from src.core.exceptions import GuardError
from src.domain.constants import APP_SECRETS, SECRET_KEY_MAP, TF_MANAGED_SECRETS
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

    # USER_ alias mapping for local .env -> canonical SM/SSM keys
    _USER_ALIASES: dict[str, list[str]] = {
        "DATABASE_URL": ["USER_DATABASE_URL"],
        "DATABASE_URL_MIGRATE": ["USER_DATABASE_URL_MIGRATE"],
        "REDIS_URL": ["USER_REDIS_URL"],
        "JWT_SECRET": ["USER_JWT_SECRET"],
        "LOG_LEVEL": ["USER_LOG_LEVEL"],
        "REDIS_CACHE_TTL_MS": ["USER_CACHE_TTL_MS"],
        "REDIS_MISSING_CACHE_TTL_MS": ["USER_MISSING_CACHE_TTL_MS"],
        "PORT": ["USER_SERVICE_INT_PORT", "USER_SERVICE_EXT_PORT"],
        "PG_POOL_MAX": ["USER_PG_POOL_MAX"],
        "PG_POOL_IDLE_TIMEOUT_MS": ["USER_PG_POOL_IDLE_TIMEOUT_MS"],
        "PG_POOL_CONNECTION_TIMEOUT_MS": ["USER_PG_POOL_CONNECTION_TIMEOUT_MS"],
    }

    # AI_ alias mapping for local .env -> canonical SM/SSM keys
    _AI_ALIASES: dict[str, list[str]] = {
        "PORT": ["AI_SERVICE_INT_PORT"],
        "METRICS_PORT": ["AI_METRICS_INT_PORT"],
        "LOG_LEVEL": ["AI_LOG_LEVEL"],
        "LLM_API_URL": ["AI_LLM_API_URL"],
        "LLM_API_KEY": ["LIGHTNING_AI_API_KEY"],
        "LLM_MODEL": ["AI_LIGHTNING_MODEL"],
        "LLM_MODE": ["AI_LLM_MODE"],
        "LLM_TIMEOUT_SECONDS": ["AI_TIMEOUT_SECONDS"],
        "CHECKPOINT_DB_URL": ["AI_CHECKPOINT_DB_URL"],
        "CHECKPOINT_DB_URL_MIGRATE": ["AI_CHECKPOINT_DB_URL_MIGRATE"],
        "CHECKPOINT_POOL_MIN_SIZE": ["AI_CHECKPOINT_POOL_MIN_SIZE"],
        "CHECKPOINT_POOL_MAX_SIZE": ["AI_CHECKPOINT_POOL_MAX_SIZE"],
        "LANGCHAIN_TRACING": ["AI_LANGCHAIN_TRACING"],
        "LANGCHAIN_API_KEY": ["AI_LANGCHAIN_API_KEY"],
        "LANGCHAIN_PROJECT": ["AI_LANGCHAIN_PROJECT"],
        "QDRANT_URL": ["AI_QDRANT_URL"],
        "QDRANT_API_KEY": ["AI_QDRANT_API_KEY"],
        "QDRANT_VECTOR_SIZE": ["AI_QDRANT_VECTOR_SIZE"],
        "SEARCH_DENSE_SCORE_THRESHOLD": ["AI_SEARCH_DENSE_SCORE_THRESHOLD"],
        "EMBEDDING_MODE": ["AI_EMBEDDING_MODE"],
        "EMBEDDING_URL": ["AI_EMBEDDING_URL"],
        "EMBEDDING_MODEL": ["AI_EMBEDDING_MODEL"],
        "OTEL_EXPORTER_OTLP_ENDPOINT": ["AI_OTLP_ENDPOINT"],
        "CONTENT_SERVICE_URL": ["AI_CONTENT_SERVICE_URL"],
    }

    def build_payloads(self, env: dict[str, str], only: frozenset[str] | None = None) -> list[SecretPayload]:
        """Build per-secret payloads from parsed env dict.

        - Only keys in allowlist are considered.
        - Empty values are skipped.
        - USER_/AI_ prefixed aliases are resolved to canonical keys.
        """
        present: dict[str, str] = {k: v for k, v in env.items() if v != ""}

        payloads: list[SecretPayload] = []
        for secret_name, keys in SECRET_KEY_MAP.items():
            if only and secret_name not in only:
                continue
            data: dict[str, str] = {}
            for k in keys:
                v = present.get(k, "")
                if v != "" and v is not None:
                    data[k] = v
                    continue
                # Check aliases for this canonical key
                for alias in self._USER_ALIASES.get(k, []) + self._AI_ALIASES.get(k, []):
                    av = present.get(alias, "")
                    if av != "" and av is not None:
                        data[k] = av
                        break
            if not data:
                continue
            payloads.append(SecretPayload(name=secret_name, data=data))

        return payloads

    def execute(self, config: SeedConfig, env: dict[str, str]) -> tuple[list[tuple[str, str]], list[str]]:
        """Alias for seed."""
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

        payloads = self.build_payloads(env, only=config.only)

        generated: list[str] = []

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
