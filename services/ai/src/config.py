import json
import logging
import os
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# AI_-prefixed compose vars resolve to canonical settings keys when the
# canonical var is unset (mirrors the content service aliases and the
# user service USER_ aliases).
_AI_ALIASES = {
    "AI_SERVICE_INT_PORT": "PORT",
    "AI_METRICS_INT_PORT": "METRICS_PORT",
    "AI_LOG_LEVEL": "LOG_LEVEL",
    "AI_LLM_API_URL": "LLM_API_URL",
    "LIGHTNING_AI_API_KEY": "LLM_API_KEY",
    "AI_LIGHTNING_MODEL": "LLM_MODEL",
    "AI_LLM_MODE": "LLM_MODE",
    "AI_TIMEOUT_SECONDS": "LLM_TIMEOUT_SECONDS",
    "AI_CONTENT_SERVICE_URL": "CONTENT_SERVICE_URL",
    "AI_LANGCHAIN_TRACING": "LANGCHAIN_TRACING",
    "AI_LANGCHAIN_API_KEY": "LANGCHAIN_API_KEY",
    "AI_LANGCHAIN_PROJECT": "LANGCHAIN_PROJECT",
    "AI_CHECKPOINT_DB_URL": "CHECKPOINT_DB_URL",
    "AI_QDRANT_URL": "QDRANT_URL",
    "AI_QDRANT_API_KEY": "QDRANT_API_KEY",
    "AI_QDRANT_VECTOR_SIZE": "QDRANT_VECTOR_SIZE",
    "AI_SEARCH_DENSE_SCORE_THRESHOLD": "SEARCH_DENSE_SCORE_THRESHOLD",
    "AI_EMBEDDING_MODE": "EMBEDDING_MODE",
    "AI_EMBEDDING_URL": "EMBEDDING_URL",
    "AI_EMBEDDING_MODEL": "EMBEDDING_MODEL",
    "AI_OTLP_ENDPOINT": "OTEL_EXPORTER_OTLP_ENDPOINT",
}


def _normalize_ai_aliases() -> None:
    for aliased, canonical in _AI_ALIASES.items():
        if (
            os.environ.get(aliased, "").strip()
            and not os.environ.get(canonical, "").strip()
        ):
            os.environ[canonical] = os.environ[aliased].strip()


def _fill_missing(values: dict) -> None:
    for k, v in values.items():
        if v is not None and str(v).strip() and not os.environ.get(k, "").strip():
            os.environ[k] = str(v)


def _hydrate_from_aws() -> None:
    """Fill unset settings from SSM/SM when ENV_TYPE=prod. Never raises."""
    try:
        import boto3
        from botocore.config import Config as BotoConfig
        from botocore.exceptions import ClientError
    except ImportError:
        logger.warning("ai config: ENV_TYPE=prod but boto3 is not installed")
        return

    region = os.environ.get("AWS_REGION", "").strip() or "ap-south-1"
    endpoint = os.environ.get("AWS_ENDPOINT_URL", "").strip()
    secrets_name = os.environ.get("AI_SECRETS_NAME", "").strip() or "topos/ai/secrets"
    config_param = os.environ.get("AI_CONFIG_PARAM", "").strip() or "/topos/ai/config"

    common: dict = {
        "region_name": region,
        "config": BotoConfig(
            connect_timeout=5, read_timeout=5, retries={"max_attempts": 1}
        ),
    }
    if endpoint:
        # Floci uses dummy creds; real AWS uses task role / env creds.
        common["endpoint_url"] = endpoint
        common["aws_access_key_id"] = os.environ.get("AWS_ACCESS_KEY_ID") or "test"
        common["aws_secret_access_key"] = (
            os.environ.get("AWS_SECRET_ACCESS_KEY") or "test"
        )
    try:
        ssm = boto3.client("ssm", **common)
        sm = boto3.client("secretsmanager", **common)
    except Exception as e:  # noqa: BLE001 - startup must survive any AWS failure
        logger.warning("ai config: AWS client init failed: %s", e)
        return

    try:
        out = ssm.get_parameter(Name=config_param)
        parsed = json.loads(out["Parameter"]["Value"])
        if isinstance(parsed, dict):
            _fill_missing(parsed)
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code == "ParameterNotFound":
            logger.debug("ai config: SSM param not found: %s", config_param)
        else:
            logger.warning("ai config: SSM fetch failed: %s", e)
    except Exception as e:  # noqa: BLE001 - startup must survive any AWS failure
        logger.warning("ai config: SSM fetch failed: %s", e)

    try:
        out = sm.get_secret_value(SecretId=secrets_name)
        if out.get("SecretString"):
            parsed = json.loads(out["SecretString"])
            if isinstance(parsed, dict):
                _fill_missing(parsed)
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code == "ResourceNotFoundException":
            logger.debug("ai config: SM secret not found: %s", secrets_name)
        else:
            logger.warning("ai config: SM fetch failed: %s", e)
    except Exception as e:  # noqa: BLE001 - startup must survive any AWS failure
        logger.warning("ai config: SM fetch failed: %s", e)


class Settings(BaseSettings):
    ENV_TYPE: Literal["dev", "prod"] = "dev"
    AWS_REGION: str = "ap-south-1"
    AWS_ENDPOINT_URL: str = ""
    AI_SECRETS_NAME: str = "topos/ai/secrets"
    AI_CONFIG_PARAM: str = "/topos/ai/config"
    PORT: str = "50051"
    GRACE_SECONDS: int = 5
    METRICS_PORT: int = 12666
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    LLM_MODE: Literal["real", "fake"] = "real"
    LLM_API_URL: str = "https://lightning.ai/api/v1/chat/completions"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "lightning-ai/gpt-oss-20b"
    LLM_TIMEOUT_SECONDS: int = 60
    # LangGraph checkpoint store (Postgres). Empty keeps graphs on the
    # in-memory checkpointer, so local dev and tests need no database.
    CHECKPOINT_DB_URL: str = ""
    # Attempts, 5s apart, before failing startup when the checkpoint
    # store is unreachable.
    CHECKPOINT_STARTUP_RETRIES: int = 12
    # LangSmith tracing on LLM calls; the SDK reads these same names from
    # the environment directly.
    LANGCHAIN_TRACING: bool = False
    LANGCHAIN_API_KEY: str = ""
    LANGCHAIN_PROJECT: str = "topos-ai"
    MAX_POST_CHARS: int = 5000
    MAX_INPUT_CHARS: int = 5000
    MAX_BODY_CHARS: int = 3000
    MAX_TITLE_CHARS: int = 200
    OTEL_EXPORTER_OTLP_ENDPOINT: str = ""
    OTEL_SERVICE_NAME: str = "ai-service"

    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION: str = "posts"
    # User interest profiles: one point per user with their dense taste
    # vector and sparse tag weights. Same vector config as the posts
    # collection.
    QDRANT_USERS_COLLECTION: str = "users"
    QDRANT_VECTOR_SIZE: int = 1024
    QDRANT_TIMEOUT_SECONDS: int = 10
    # Interaction weights folded into a user's interest profile; mirrors
    # the content service's fixed view/like/save weights.
    PROFILE_VIEW_WEIGHT: float = 1.0
    PROFILE_LIKE_WEIGHT: float = 3.0
    PROFILE_SAVE_WEIGHT: float = 5.0
    # Surprise-sourced interactions fold into the taste profile at a
    # reduced weight: they start from anti-taste suggestions, so each
    # one counts for less than a direct like.
    PROFILE_SURPRISE_FEEDBACK_MULTIPLIER: float = 0.5
    # Caps keeping a single user's profile bounded: interaction history,
    # distinct interest tags, and the weight any one tag can accumulate.
    PROFILE_SEEN_POSTS_CAP: int = 200
    PROFILE_MAX_TAGS: int = 64
    PROFILE_TAG_WEIGHT_CAP: float = 10.0
    # Validation limit for user ids accepted by the profile RPCs.
    PROFILE_MAX_ID_CHARS: int = 128
    # Recommendations only surface posts created within this window; posts
    # without a usable created_at are excluded from the feed.
    RECOMMEND_RECENCY_DAYS: int = 60

    # Feed agent (Layer 2): "deterministic" serves today's engine paths;
    # "agent" lets an LLM pick a blend preset per user; "fake" scripts the
    # decision so tests and load runs stay off the LLM.
    AGENT_MODE: Literal["deterministic", "agent", "fake"] = "deterministic"
    # How long a user's decided preset is reused before asking again.
    AGENT_DECISION_TTL_SECONDS: int = 300
    # Blend knobs the presets resolve to: FRESH narrows the recency
    # window; EXPLORER interleaves that share of surprise pages into the
    # default ranking.
    FEED_FRESH_RECENCY_DAYS: int = 14
    FEED_EXPLORER_SURPRISE_RATIO: float = 0.3
    # Surprise mode queries the negated profile vector, so scores above
    # this threshold mean posts genuinely unlike the user's taste
    # (cos(profile, post) < -SURPRISE_DENSE_SCORE_THRESHOLD). When a page
    # cannot fill, the threshold relaxes by STEP per attempt down to
    # FLOOR, after which the feed falls back to recent posts.
    SURPRISE_DENSE_SCORE_THRESHOLD: float = 0.1
    SURPRISE_THRESHOLD_STEP: float = 0.1
    SURPRISE_THRESHOLD_FLOOR: float = -0.9
    # How many of the user's least-used tags feed the surprise sparse
    # channel: their low weights make them the weakest expression of taste.
    SURPRISE_TAG_TOP_K: int = 10
    # Attempts, 5s apart, before failing startup when Qdrant is unreachable.
    QDRANT_STARTUP_RETRIES: int = 12
    SEARCH_MAX_RESULT_WINDOW: int = 1000
    SEARCH_MAX_QUERY_CHARS: int = 512
    SEARCH_MAX_LIMIT: int = 100
    # Default number of related posts returned when the request omits limit.
    RELATED_DEFAULT_LIMIT: int = 10
    # Minimum dense cosine similarity for a point to be a search result.
    # Keeps semantically unrelated text (e.g. gibberish queries) from
    # surfacing as "best matches"; tune per embedding model.
    SEARCH_DENSE_SCORE_THRESHOLD: float = 0.3

    # Grounded chat: how many posts to retrieve, how much conversation to
    # consider, and the total excerpt budget fed to the LLM per turn.
    CHAT_TOP_K_DEFAULT: int = 5
    CHAT_MAX_TOP_K: int = 10
    CHAT_MAX_HISTORY_TURNS: int = 6
    CHAT_MAX_CONTEXT_CHARS: int = 12000
    # Retrieval rounds per chat turn; a failing relevance verdict loops
    # back through rewrite_query until this budget is spent.
    CHAT_MAX_RETRIEVAL_ROUNDS: int = 2
    # Tool invocations the agent may execute within one chat turn.
    CHAT_MAX_TOOL_CALLS: int = 6
    # Content service bridge for full post bodies (get_post_body tool);
    # empty token keeps the tool on its placeholder response.
    CONTENT_SERVICE_URL: str = "http://content-service:4002"
    CONTENT_INTERNAL_TOKEN: str = ""
    # Multi-source grounding: per-source weights feed the weighted
    # reciprocal-rank fusion; concurrency bounds the parallel fan-out.
    CHAT_DENSE_SOURCE_WEIGHT: float = 1.0
    CHAT_HYBRID_SOURCE_WEIGHT: float = 0.8
    CHAT_RETRIEVAL_CONCURRENCY: int = 2

    # Which vector store backs search and related posts. "qdrant" is the
    # real store; "fake" runs a deterministic in-memory index with the
    # same semantics, for docker-free local dev and cheap load tests.
    VECTOR_MODE: Literal["fake", "qdrant"] = "qdrant"

    # Where dense vectors come from. "fake" and "ollama" embed client-side
    # (deterministic vectors, or a self-hosted Ollama server); "inference"
    # lets Qdrant Cloud embed server-side from the raw text, so the service
    # never handles dense vectors on that path. Dev stays on docker.
    EMBEDDING_MODE: Literal["fake", "ollama", "inference"] = "fake"
    EMBEDDING_URL: str = "http://embedding-service:11434"
    EMBEDDING_MODEL: str = "snowflake-arctic-embed2:568m"
    EMBEDDING_BATCH_SIZE: int = 64
    EMBEDDING_MAX_CHARS: int = 8000
    EMBEDDING_TIMEOUT_SECONDS: int = 30

    SPARSE_MIN_TOKEN_LENGTH: int = 2
    SPARSE_PREFIX_MIN_LENGTH: int = 3
    SPARSE_MAX_TOKENS: int = 512

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    def __init__(self, **kwargs):
        _normalize_ai_aliases()
        super().__init__(**kwargs)


_normalize_ai_aliases()
if os.environ.get("ENV_TYPE", "").strip() == "prod":
    _hydrate_from_aws()
    _normalize_ai_aliases()

settings = Settings()
