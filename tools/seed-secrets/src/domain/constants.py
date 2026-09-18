"""Single source of truth for secret names, keys and guard lists — Topos + legacy DetectAI."""

# Terraform-managed secrets — never overwritten without --force
TF_MANAGED_SECRETS = frozenset(
    {
        "detectai/pg/urls",
        "detectai/pg/master",
        "detectai/docdb/urls",
        "detectai/redis/chat/urls",
        "detectai/redis/events/urls",
        "detectai/redis/users/urls",
        "detectai/mq/urls",
    }
)

# --- Topos: Frontend — SSM Parameter Store (public config, String, hierarchical) ---
# Stored as JSON blob in one SSM parameter to keep existing payload model.
FRONTEND_SSM_PARAM = "/topos/frontend/config"

# --- Legacy DetectAI (kept for test compat, gradually migrates to topos/*) ---
WEB_SECRET = "detectai/web/secrets"
GATEWAY_SECRET = "detectai/gateway/secrets"
WORKERS_SECRET = "detectai/workers/secrets"
INFERENCE_SECRET = "detectai/inference/secrets"
DOC_PARSER_SECRET = "detectai/document-parser/secrets"

APP_SECRETS = frozenset(
    {
        FRONTEND_SSM_PARAM,
        WEB_SECRET,
        GATEWAY_SECRET,
        WORKERS_SECRET,
        INFERENCE_SECRET,
        DOC_PARSER_SECRET,
    }
)

# Mapping: secret/param name -> env keys that belong to it
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
    WEB_SECRET: [
        "NEXTAUTH_SECRET",
        "INTERNAL_API_KEY",
        "AI_SERVICE_API_KEY",
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
        "TURNSTILE_SECRET_KEY",
        "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
        "GOOGLE_ID",
        "GOOGLE_SECRET",
        "GITHUB_ID",
        "GITHUB_SECRET",
        "PROMETHEUS_WEB_SCRAPE_TOKEN",
    ],
    GATEWAY_SECRET: [
        "PADDLE_WEBHOOK_SECRET",
        "INTERNAL_API_KEY",
    ],
    WORKERS_SECRET: [
        "PADDLE_API_KEY",
        "PADDLE_ENVIRONMENT",
    ],
    INFERENCE_SECRET: [
        "API_KEY",
        "HF_TOKEN",
    ],
    DOC_PARSER_SECRET: [],
}

# Allowlist = union of all keys we ever read from .env
ALLOWLIST: frozenset[str] = frozenset(
    {k for keys in SECRET_KEY_MAP.values() for k in keys}
    | {
        "HF_TOKEN",
        "PADDLE_ENVIRONMENT",
        "AI_SERVICE_API_KEY",
    }
)

# Shared keys — one value generated once and synced across secrets (DetectAI legacy)
SHARED_KEYS = frozenset({"INTERNAL_API_KEY", "AI_SERVICE_API_KEY", "API_KEY"})
API_KEY_FALLBACK = "AI_SERVICE_API_KEY"
DEFAULT_PADDLE_ENV = "sandbox"
