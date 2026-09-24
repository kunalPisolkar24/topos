import os
import pathlib

import pytest
from pydantic import ValidationError

from src.config import Settings


@pytest.fixture
def isolated_settings(tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(tmp_path)
    return Settings()


DEFAULTS = {
    "ENV_TYPE": "dev",
    "AWS_REGION": "ap-south-1",
    "AWS_ENDPOINT_URL": "",
    "AI_SECRETS_NAME": "topos/ai/secrets",
    "AI_CONFIG_PARAM": "/topos/ai/config",
    "PORT": "50051",
    "GRACE_SECONDS": 5,
    "METRICS_PORT": 12666,
    "LOG_LEVEL": "INFO",
    "LLM_API_URL": "https://lightning.ai/api/v1/chat/completions",
    "LLM_API_KEY": "",
    "LLM_MODEL": "lightning-ai/gpt-oss-20b",
    "LLM_TIMEOUT_SECONDS": 60,
    "CHECKPOINT_DB_URL": "",
    "CHECKPOINT_STARTUP_RETRIES": 12,
    "LANGCHAIN_TRACING": False,
    "LANGCHAIN_API_KEY": "",
    "LANGCHAIN_PROJECT": "topos-ai",
    "MAX_POST_CHARS": 5000,
    "MAX_INPUT_CHARS": 5000,
    "MAX_BODY_CHARS": 3000,
    "MAX_TITLE_CHARS": 200,
    "OTEL_EXPORTER_OTLP_ENDPOINT": "",
    "OTEL_SERVICE_NAME": "ai-service",
    "QDRANT_URL": "http://localhost:6333",
    "QDRANT_COLLECTION": "posts",
    "QDRANT_USERS_COLLECTION": "users",
    "QDRANT_VECTOR_SIZE": 1024,
    "QDRANT_STARTUP_RETRIES": 12,
    "PROFILE_VIEW_WEIGHT": 1.0,
    "PROFILE_LIKE_WEIGHT": 3.0,
    "PROFILE_SAVE_WEIGHT": 5.0,
    "PROFILE_SEEN_POSTS_CAP": 200,
    "PROFILE_MAX_TAGS": 64,
    "PROFILE_TAG_WEIGHT_CAP": 10.0,
    "PROFILE_MAX_ID_CHARS": 128,
    "RECOMMEND_RECENCY_DAYS": 60,
    "SURPRISE_DENSE_SCORE_THRESHOLD": 0.1,
    "SURPRISE_THRESHOLD_STEP": 0.1,
    "SURPRISE_THRESHOLD_FLOOR": -0.9,
    "SURPRISE_TAG_TOP_K": 10,
    "SEARCH_DENSE_SCORE_THRESHOLD": 0.3,
    "CHAT_MAX_RETRIEVAL_ROUNDS": 2,
    "CHAT_MAX_TOOL_CALLS": 6,
    "CONTENT_SERVICE_URL": "http://content-service:4002",
    "CONTENT_INTERNAL_TOKEN": "",
    "CHAT_DENSE_SOURCE_WEIGHT": 1.0,
    "CHAT_HYBRID_SOURCE_WEIGHT": 0.8,
    "CHAT_RETRIEVAL_CONCURRENCY": 2,
}


@pytest.mark.parametrize("field,expected", DEFAULTS.items())
def test_defaults(isolated_settings: Settings, field: str, expected) -> None:
    assert getattr(isolated_settings, field) == expected


OVERRIDES = {
    "ENV_TYPE": "dev",
    "AWS_REGION": "eu-west-1",
    "AWS_ENDPOINT_URL": "http://localhost:4566",
    "AI_SECRETS_NAME": "topos/ai/test-secrets",
    "AI_CONFIG_PARAM": "/topos/ai/test-config",
    "PORT": "50055",
    "GRACE_SECONDS": 9,
    "METRICS_PORT": 9091,
    "LOG_LEVEL": "WARNING",
    "LLM_API_KEY": "test-key",
    "LLM_MODEL": "some-other-model",
    "LLM_TIMEOUT_SECONDS": 30,
    "CHECKPOINT_DB_URL": "postgresql://db:5432/checkpoints",
    "CHECKPOINT_STARTUP_RETRIES": 3,
    "LANGCHAIN_TRACING": True,
    "LANGCHAIN_API_KEY": "lsv2_test",
    "LANGCHAIN_PROJECT": "topos-test",
    "MAX_POST_CHARS": 10000,
    "MAX_INPUT_CHARS": 10000,
    "MAX_BODY_CHARS": 1000,
    "MAX_TITLE_CHARS": 100,
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://collector:4317",
    "OTEL_SERVICE_NAME": "ai-test",
    "QDRANT_URL": "http://qdrant:6333",
    "QDRANT_COLLECTION": "test-posts",
    "QDRANT_USERS_COLLECTION": "test-users",
    "QDRANT_VECTOR_SIZE": 768,
    "QDRANT_STARTUP_RETRIES": 3,
    "PROFILE_VIEW_WEIGHT": 2.0,
    "PROFILE_LIKE_WEIGHT": 4.0,
    "PROFILE_SAVE_WEIGHT": 6.0,
    "PROFILE_SEEN_POSTS_CAP": 10,
    "PROFILE_MAX_TAGS": 8,
    "PROFILE_TAG_WEIGHT_CAP": 5.0,
    "PROFILE_MAX_ID_CHARS": 64,
    "RECOMMEND_RECENCY_DAYS": 7,
    "SURPRISE_DENSE_SCORE_THRESHOLD": 0.25,
    "SURPRISE_THRESHOLD_STEP": 0.05,
    "SURPRISE_THRESHOLD_FLOOR": -0.5,
    "SURPRISE_TAG_TOP_K": 4,
    "SEARCH_DENSE_SCORE_THRESHOLD": 0.55,
    "CHAT_MAX_RETRIEVAL_ROUNDS": 3,
    "CHAT_MAX_TOOL_CALLS": 4,
    "CONTENT_SERVICE_URL": "http://content-svc:4002",
    "CONTENT_INTERNAL_TOKEN": "token",
    "CHAT_DENSE_SOURCE_WEIGHT": 1.5,
    "CHAT_HYBRID_SOURCE_WEIGHT": 0.5,
    "CHAT_RETRIEVAL_CONCURRENCY": 4,
}


@pytest.mark.parametrize("field,value", OVERRIDES.items())
def test_env_override(monkeypatch: pytest.MonkeyPatch, field: str, value) -> None:
    monkeypatch.setenv(field, str(value))

    assert getattr(Settings(), field) == value


def test_invalid_grace_seconds_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GRACE_SECONDS", "abc")

    with pytest.raises(ValidationError):
        Settings()


def test_ai_aliases_resolve_to_canonical(monkeypatch: pytest.MonkeyPatch) -> None:
    for canonical in ("LLM_API_KEY", "LLM_MODEL", "LLM_MODE", "QDRANT_URL"):
        monkeypatch.delenv(canonical, raising=False)
    monkeypatch.setenv("LIGHTNING_AI_API_KEY", "alias-key")
    monkeypatch.setenv("AI_LIGHTNING_MODEL", "alias-model")
    monkeypatch.setenv("AI_LLM_MODE", "fake")
    monkeypatch.setenv("AI_QDRANT_URL", "http://alias-qdrant:6333")

    s = Settings()
    assert s.LLM_API_KEY == "alias-key"
    assert s.LLM_MODEL == "alias-model"
    assert s.LLM_MODE == "fake"
    assert s.QDRANT_URL == "http://alias-qdrant:6333"
    for canonical in ("LLM_API_KEY", "LLM_MODEL", "LLM_MODE", "QDRANT_URL"):
        os.environ.pop(canonical, None)


def test_canonical_env_wins_over_alias(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_MODEL", "canonical-model")
    monkeypatch.setenv("AI_LIGHTNING_MODEL", "alias-model")

    assert Settings().LLM_MODEL == "canonical-model"


def _install_fake_boto3(monkeypatch: pytest.MonkeyPatch, ssm_value=None, sm_value=None):
    import sys
    import types

    from botocore.exceptions import ClientError

    seen: dict = {}

    class FakeSSM:
        def get_parameter(self, Name):
            seen["ssm_name"] = Name
            if ssm_value is None:
                raise ClientError(
                    {"Error": {"Code": "ParameterNotFound"}}, "GetParameter"
                )
            return {"Parameter": {"Value": ssm_value}}

    class FakeSM:
        def get_secret_value(self, SecretId):
            seen["sm_name"] = SecretId
            if sm_value is None:
                raise ClientError(
                    {"Error": {"Code": "ResourceNotFoundException"}}, "GetSecretValue"
                )
            return {"SecretString": sm_value}

    fake = types.ModuleType("boto3")
    fake.client = lambda service, **kwargs: FakeSSM() if service == "ssm" else FakeSM()  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "boto3", fake)
    return seen


def test_prod_hydrate_fills_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    import json

    import src.config as config_mod

    monkeypatch.setenv("ENV_TYPE", "prod")
    for k in ("LLM_API_KEY", "LLM_MODEL", "QDRANT_URL", "LOG_LEVEL"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("LOG_LEVEL", "WARNING")  # already set: must win
    seen = _install_fake_boto3(
        monkeypatch,
        ssm_value=json.dumps({"LOG_LEVEL": "DEBUG", "LLM_MODEL": "hydrated-model"}),
        sm_value=json.dumps(
            {"LLM_API_KEY": "hydrated-key", "QDRANT_URL": "http://hydrated:6333"}
        ),
    )

    config_mod._hydrate_from_aws()

    assert seen["ssm_name"] == "/topos/ai/config"
    assert seen["sm_name"] == "topos/ai/secrets"
    assert Settings().LLM_MODEL == "hydrated-model"
    assert Settings().LLM_API_KEY == "hydrated-key"
    assert Settings().QDRANT_URL == "http://hydrated:6333"
    assert Settings().LOG_LEVEL == "WARNING"
    for k in ("LLM_API_KEY", "LLM_MODEL", "QDRANT_URL"):
        os.environ.pop(k, None)


def test_prod_hydrate_missing_remote_is_tolerated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import src.config as config_mod

    monkeypatch.setenv("ENV_TYPE", "prod")
    _install_fake_boto3(monkeypatch, ssm_value=None, sm_value=None)

    config_mod._hydrate_from_aws()  # must not raise

    assert Settings().LLM_API_KEY == ""
