"""Single source of truth for secret names, keys and guard lists — Topos."""

# Terraform-managed secrets — never overwritten without --force
# RDS master and ElastiCache auth are TF-managed (random_password); seed-secrets
# must not overwrite them without --force.
TF_MANAGED_SECRETS: frozenset[str] = frozenset(
    {
        "topos-user-floci/master",
        "topos-user-floci/ai-checkpointer",
        "topos-user-floci/redis-auth",
        "topos-user-dev/master",
        "topos-user-dev/ai-checkpointer",
        "topos-user-dev/redis-auth",
        "topos-user-prod/master",
        "topos-user-prod/ai-checkpointer",
        "topos-user-prod/redis-auth",
        "topos-content-floci/docdb-master",
        "topos-content-dev/docdb-master",
        "topos-content-prod/docdb-master",
    }
)

# Frontend — SSM Parameter Store (public config, String, hierarchical)
# Stored as JSON blob in one SSM parameter
FRONTEND_SSM_PARAM = "/topos/frontend/config"

# User — SSM (config) + SM (secrets)
USER_SSM_PARAM = "/topos/user/config"
USER_SM_SECRET = "topos/user/secrets"

# Content — SSM (config) + SM (secrets)
CONTENT_SSM_PARAM = "/topos/content/config"
CONTENT_SM_SECRET = "topos/content/secrets"

# AI — SSM (config) + SM (secrets)
AI_SSM_PARAM = "/topos/ai/config"
AI_SM_SECRET = "topos/ai/secrets"

APP_SECRETS = frozenset({FRONTEND_SSM_PARAM, USER_SSM_PARAM, USER_SM_SECRET, CONTENT_SSM_PARAM, CONTENT_SM_SECRET, AI_SSM_PARAM, AI_SM_SECRET})

# Mapping: SSM/SM name -> env keys that belong to it
SECRET_KEY_MAP: dict[str, list[str]] = {
    FRONTEND_SSM_PARAM: [
        "VITE_ENV_TYPE",
        "VITE_GRAPHQL_URL",
        "VITE_BACKEND_URL",
        "VITE_CLOUDINARY_CLOUD_NAME",
        "VITE_CLOUDINARY_UPLOAD_PRESET",
        "VITE_ENABLE_MOCKS",
        "FRONTEND_CONTAINER",
        "FRONTEND_INT_PORT",
        "FRONTEND_EXT_PORT",
        "APP_NETWORK",
        "GATEWAY_CONTAINER",
        "GATEWAY_INT_PORT",
        "GATEWAY_EXT_PORT",
    ],
    USER_SSM_PARAM: [
        "PORT",
        "LOG_LEVEL",
        "OTEL_SERVICE_NAME",
        "OTEL_EXPORTER_OTLP_ENDPOINT",
        "JWT_ISSUER",
        "JWT_AUDIENCE",
        "JWT_EXPIRES_IN",
        "REDIS_CACHE_TTL_MS",
        "REDIS_MISSING_CACHE_TTL_MS",
        "PG_POOL_MAX",
        "PG_POOL_IDLE_TIMEOUT_MS",
        "PG_POOL_CONNECTION_TIMEOUT_MS",
    ],
    USER_SM_SECRET: [
        "DATABASE_URL",
        "DATABASE_URL_MIGRATE",
        "AI_CHECKPOINTER_PASSWORD",
        "REDIS_URL",
        "JWT_SECRET",
    ],
    CONTENT_SSM_PARAM: [
        "PORT",
        "DB_NAME",
        "LOG_LEVEL",
        "LOG_FORMAT",
        "OTEL_SERVICE_NAME",
        "OTEL_EXPORTER_OTLP_ENDPOINT",
        "JWT_ISSUER",
        "JWT_AUDIENCE",
        "KAFKA_TOPIC",
        "KAFKA_USER_INTERACTED_TOPIC",
        "KAFKA_DLQ_TOPIC",
        "KAFKA_CONSUMER_GROUP_ID",
        "KAFKA_SEARCH_CONSUMER_GROUP_ID",
        "KAFKA_PERSONALIZER_CONSUMER_GROUP_ID",
        "WORKER_CONCURRENCY",
    ],
    CONTENT_SM_SECRET: [
        "MONGO_URI",
        "KAFKA_BROKERS",
        "REDIS_ADDR",
        "REDIS_PASSWORD",
        "JWT_SECRET",
        "INTERNAL_TOKEN",
        "AI_SERVICE_URL",
    ],
    AI_SSM_PARAM: [
        "PORT",
        "LOG_LEVEL",
        "OTEL_SERVICE_NAME",
        "OTEL_EXPORTER_OTLP_ENDPOINT",
        "LLM_MODE",
        "LLM_MODEL",
        "LLM_TIMEOUT_SECONDS",
        "VECTOR_MODE",
        "EMBEDDING_MODE",
        "EMBEDDING_MODEL",
        "EMBEDDING_BATCH_SIZE",
        "EMBEDDING_MAX_CHARS",
        "EMBEDDING_TIMEOUT_SECONDS",
        "QDRANT_COLLECTION",
        "QDRANT_USERS_COLLECTION",
        "QDRANT_VECTOR_SIZE",
        "QDRANT_TIMEOUT_SECONDS",
        "SEARCH_DENSE_SCORE_THRESHOLD",
        "SEARCH_MAX_RESULT_WINDOW",
        "SEARCH_MAX_QUERY_CHARS",
        "SEARCH_MAX_LIMIT",
        "RELATED_DEFAULT_LIMIT",
        "RECOMMEND_RECENCY_DAYS",
        "SURPRISE_DENSE_SCORE_THRESHOLD",
        "SURPRISE_THRESHOLD_STEP",
        "SURPRISE_THRESHOLD_FLOOR",
        "SURPRISE_TAG_TOP_K",
        "FEED_FRESH_RECENCY_DAYS",
        "FEED_EXPLORER_SURPRISE_RATIO",
        "AGENT_MODE",
        "AGENT_DECISION_TTL_SECONDS",
        "CHAT_TOP_K_DEFAULT",
        "CHAT_MAX_TOP_K",
        "CHAT_MAX_HISTORY_TURNS",
        "CHAT_MAX_CONTEXT_CHARS",
        "CHAT_MAX_RETRIEVAL_ROUNDS",
        "CHAT_MAX_TOOL_CALLS",
        "CHAT_DENSE_SOURCE_WEIGHT",
        "CHAT_HYBRID_SOURCE_WEIGHT",
        "CHAT_RETRIEVAL_CONCURRENCY",
        "PROFILE_VIEW_WEIGHT",
        "PROFILE_LIKE_WEIGHT",
        "PROFILE_SAVE_WEIGHT",
        "PROFILE_SURPRISE_FEEDBACK_MULTIPLIER",
        "PROFILE_SEEN_POSTS_CAP",
        "PROFILE_MAX_TAGS",
        "PROFILE_TAG_WEIGHT_CAP",
        "PROFILE_MAX_ID_CHARS",
        "MAX_POST_CHARS",
        "MAX_INPUT_CHARS",
        "MAX_BODY_CHARS",
        "MAX_TITLE_CHARS",
        "SPARSE_MIN_TOKEN_LENGTH",
        "SPARSE_PREFIX_MIN_LENGTH",
        "SPARSE_MAX_TOKENS",
        "GRACE_SECONDS",
        "METRICS_PORT",
        "LANGCHAIN_TRACING",
        "LANGCHAIN_PROJECT",
        "CHECKPOINT_POOL_MIN_SIZE",
        "CHECKPOINT_POOL_MAX_SIZE",
        "CHECKPOINT_STARTUP_RETRIES",
        "QDRANT_STARTUP_RETRIES",
    ],
    AI_SM_SECRET: [
        "LLM_API_URL",
        "LLM_API_KEY",
        "LANGCHAIN_API_KEY",
        "QDRANT_URL",
        "QDRANT_API_KEY",
        "EMBEDDING_URL",
        "CHECKPOINT_DB_URL",
        "CHECKPOINT_DB_URL_MIGRATE",
        "CONTENT_SERVICE_URL",
        "CONTENT_INTERNAL_TOKEN",
    ],
}

# Allowlist = union of all keys we ever read from .env
ALLOWLIST: frozenset[str] = frozenset({k for keys in SECRET_KEY_MAP.values() for k in keys})

# No shared generated keys for frontend (future backend may add)
SHARED_KEYS: frozenset[str] = frozenset()
