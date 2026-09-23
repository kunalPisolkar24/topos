"""Single source of truth for secret names, keys and guard lists — Topos."""

# Terraform-managed secrets — never overwritten without --force
# RDS master and ElastiCache auth are TF-managed (random_password); seed-secrets
# must not overwrite them without --force.
TF_MANAGED_SECRETS: frozenset[str] = frozenset(
    {
        "topos-user-floci/master",
        "topos-user-floci/redis-auth",
        "topos-user-dev/master",
        "topos-user-dev/redis-auth",
        "topos-user-prod/master",
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

APP_SECRETS = frozenset({FRONTEND_SSM_PARAM, USER_SSM_PARAM, USER_SM_SECRET, CONTENT_SSM_PARAM, CONTENT_SM_SECRET})

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
    ],
    USER_SM_SECRET: [
        "DATABASE_URL",
        "DATABASE_URL_MIGRATE",
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
}

# Allowlist = union of all keys we ever read from .env
ALLOWLIST: frozenset[str] = frozenset({k for keys in SECRET_KEY_MAP.values() for k in keys})

# No shared generated keys for frontend (future backend may add)
SHARED_KEYS: frozenset[str] = frozenset()
