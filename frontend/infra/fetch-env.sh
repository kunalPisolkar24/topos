#!/usr/bin/env bash
# Fetches frontend prod config from AWS (SSM Parameter Store + Secrets Manager)
# and prints KEY=VALUE lines for `docker compose --env-file`.
#
# - VITE_ENV_TYPE != prod  -> no-op, exit 0 with no output (dev uses compose + .env).
# - VITE_ENV_TYPE == prod  -> read SSM JSON blob, overlay optional SM JSON secret.
#
# Env:
#   VITE_ENV_TYPE        must be "prod" to fetch (default: dev)
#   AWS_REGION           default: ap-south-1
#   AWS_ENDPOINT_URL     Floci/LocalStack URL, e.g. http://localhost:4566; empty = real AWS
#   FRONTEND_SSM_PARAM   default: /topos/frontend/config
#   FRONTEND_SM_SECRET   default: topos/frontend/secrets (missing = skip, not an error)
#
# Usage:
#   VITE_ENV_TYPE=prod ./infra/fetch-env.sh --output .env.aws
#   VITE_ENV_TYPE=prod ./infra/fetch-env.sh > .env.aws
#   VITE_ENV_TYPE=prod ./infra/fetch-env.sh --dry-run   # names only, no values
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"
AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-}"
FRONTEND_SSM_PARAM="${FRONTEND_SSM_PARAM:-/topos/frontend/config}"
FRONTEND_SM_SECRET="${FRONTEND_SM_SECRET:-topos/frontend/secrets}"
ENV_TYPE="${VITE_ENV_TYPE:-dev}"

DRY_RUN=0
OUTPUT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --output) OUTPUT="${2:?--output needs a file}"; shift 2 ;;
    -h|--help)
      sed -n '1,20p' "$0"
      exit 0
      ;;
    *) echo "fetch-env: unknown arg $1" >&2; exit 2 ;;
  esac
done

if [ "$ENV_TYPE" != "prod" ]; then
  echo "fetch-env: VITE_ENV_TYPE=$ENV_TYPE, skipping AWS fetch (dev uses compose + .env)" >&2
  exit 0
fi

for cmd in aws jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "fetch-env: missing required command '$cmd'" >&2
    exit 2
  fi
done

AWS_BASE=(--region "$AWS_REGION")
if [ -n "$AWS_ENDPOINT_URL" ]; then
  AWS_BASE+=(--endpoint-url "$AWS_ENDPOINT_URL")
fi

TARGET="${AWS_ENDPOINT_URL:-real AWS}"

SSM_JSON="$(aws "${AWS_BASE[@]}" ssm get-parameter --name "$FRONTEND_SSM_PARAM" --query 'Parameter.Value' --output text)" \
  || { echo "fetch-env: failed to read SSM $FRONTEND_SSM_PARAM from $TARGET" >&2; exit 1; }

SM_JSON=""
if SM_OUT="$(aws "${AWS_BASE[@]}" secretsmanager get-secret-value --secret-id "$FRONTEND_SM_SECRET" --query SecretString --output text 2>/dev/null)"; then
  SM_JSON="$SM_OUT"
else
  echo "fetch-env: no SM secret $FRONTEND_SM_SECRET (skipping, SSM only)" >&2
fi

if [ "$DRY_RUN" = "1" ]; then
  echo "[dry-run] SSM $FRONTEND_SSM_PARAM keys (no values):" 
  echo "$SSM_JSON" | jq -r 'keys_unsorted | join(", ")'
  if [ -n "$SM_JSON" ]; then
    echo "[dry-run] SM $FRONTEND_SM_SECRET keys (no values):"
    echo "$SM_JSON" | jq -r 'keys_unsorted | join(", ")'
  fi
  echo "[dry-run] no file written."
  exit 0
fi

if [ -n "$SM_JSON" ]; then
  MERGED="$(jq -n --argjson a "$SSM_JSON" --argjson b "$SM_JSON" '$a * $b')"
else
  MERGED="$SSM_JSON"
fi

OUT="$(echo "$MERGED" | jq -r 'to_entries[] | "\(.key)=\(.value)"')"
COUNT="$(echo "$OUT" | grep -c '=' || true)"

if [ -n "$OUTPUT" ]; then
  printf '%s\n' "$OUT" > "$OUTPUT"
  echo "fetch-env: wrote $COUNT keys to $OUTPUT from $TARGET" >&2
else
  printf '%s\n' "$OUT"
fi
