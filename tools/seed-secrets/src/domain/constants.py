"""Single source of truth for secret names, keys and guard lists — Topos."""

# Terraform-managed secrets — never overwritten without --force
# Topos currently has no TF-managed secrets; add here if needed (e.g., "topos/pg/urls")
TF_MANAGED_SECRETS: frozenset[str] = frozenset()

# Frontend — SSM Parameter Store (public config, String, hierarchical)
# Stored as JSON blob in one SSM parameter
FRONTEND_SSM_PARAM = "/topos/frontend/config"

APP_SECRETS = frozenset({FRONTEND_SSM_PARAM})

# Mapping: SSM parameter name -> env keys that belong to it
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
}

# Allowlist = union of all keys we ever read from .env
ALLOWLIST: frozenset[str] = frozenset({k for keys in SECRET_KEY_MAP.values() for k in keys})

# No shared generated keys for frontend (future backend may add)
SHARED_KEYS: frozenset[str] = frozenset()
