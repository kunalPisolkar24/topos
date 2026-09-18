#!/bin/sh
# Generates runtime config for the SPA from container environment.
# Runs via nginx /docker-entrypoint.d/ before nginx starts.
# Single image serves dev/preview/prod: same dist/, different config.js.
set -eu

CONFIG_FILE="${FRONTEND_CONFIG_FILE:-/usr/share/nginx/html/config.js}"

js_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e "s/'/\\\\'/g" | tr -d '\n\r'
}

VITE_ENV_TYPE_VAL="${VITE_ENV_TYPE:-dev}"
VITE_GRAPHQL_URL_VAL="${VITE_GRAPHQL_URL:-}"
VITE_BACKEND_URL_VAL="${VITE_BACKEND_URL:-}"
VITE_CLOUDINARY_CLOUD_NAME_VAL="${VITE_CLOUDINARY_CLOUD_NAME:-}"
VITE_CLOUDINARY_UPLOAD_PRESET_VAL="${VITE_CLOUDINARY_UPLOAD_PRESET:-}"
VITE_ENABLE_MOCKS_VAL="${VITE_ENABLE_MOCKS:-}"

cat > "$CONFIG_FILE" <<EOF
window.__APP_CONFIG__ = {
  VITE_ENV_TYPE: '$(js_escape "$VITE_ENV_TYPE_VAL")',
  VITE_GRAPHQL_URL: '$(js_escape "$VITE_GRAPHQL_URL_VAL")',
  VITE_BACKEND_URL: '$(js_escape "$VITE_BACKEND_URL_VAL")',
  VITE_CLOUDINARY_CLOUD_NAME: '$(js_escape "$VITE_CLOUDINARY_CLOUD_NAME_VAL")',
  VITE_CLOUDINARY_UPLOAD_PRESET: '$(js_escape "$VITE_CLOUDINARY_UPLOAD_PRESET_VAL")',
  VITE_ENABLE_MOCKS: '$(js_escape "$VITE_ENABLE_MOCKS_VAL")'
};
EOF

echo "frontend-config: wrote $CONFIG_FILE (VITE_ENV_TYPE=$VITE_ENV_TYPE_VAL)"
