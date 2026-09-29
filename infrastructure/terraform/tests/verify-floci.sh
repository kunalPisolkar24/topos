#!/usr/bin/env bash
# Verify the live Floci integration after Terraform has applied the stack.
# This deliberately uses only AWS-compatible APIs and never prints secrets.
set -euo pipefail

endpoint_url="${AWS_ENDPOINT_URL:-http://localhost:4566}"
region="${AWS_REGION:-ap-south-1}"

# Floci accepts the conventional local credentials. Supplying defaults makes
# the script work on a fresh machine without touching a developer's AWS
# profile; explicitly exported credentials still take precedence.
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$region}"

aws_floci() {
  aws --endpoint-url "$endpoint_url" --region "$region" "$@"
}

require_value() {
  local description="$1"
  local value="$2"
  if [[ -z "$value" || "$value" == "None" ]]; then
    echo "missing ${description}" >&2
    exit 1
  fi
}

require_value "RDS instance" "$(aws_floci rds describe-db-instances --db-instance-identifier topos-user-floci-db --query 'DBInstances[0].DBInstanceStatus' --output text)"
require_value "ElastiCache replication group" "$(aws_floci elasticache describe-replication-groups --replication-group-id topos-user-floci-cache --query 'ReplicationGroups[0].Status' --output text)"
require_value "DocumentDB cluster" "$(aws_floci docdb describe-db-clusters --db-cluster-identifier topos-content-floci-docdb --query 'DBClusters[0].Status' --output text)"
require_value "MSK cluster" "$(aws_floci kafka list-clusters --query 'ClusterInfoList[0].ClusterArn' --output text)"

for parameter in /topos/user/config /topos/ai/config /topos/content/config; do
  aws_floci ssm get-parameter --name "$parameter" --query 'Parameter.Value' --output text >/dev/null
done

python3 - "$endpoint_url" "$region" <<'PY'
import json
import subprocess
import sys

endpoint, region = sys.argv[1:]


def aws(*args: str) -> dict:
    result = subprocess.run(
        ["aws", "--endpoint-url", endpoint, "--region", region, *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


expected_secret_keys = {
    "topos/user/secrets": {
        "DATABASE_URL",
        "DATABASE_URL_MIGRATE",
        "AI_CHECKPOINTER_PASSWORD",
        "REDIS_URL",
        "JWT_SECRET",
    },
    "topos/ai/secrets": {"CHECKPOINT_DB_URL", "CHECKPOINT_DB_URL_MIGRATE"},
    "topos/content/secrets": {
        "MONGO_URI",
        "KAFKA_BROKERS",
        "REDIS_ADDR",
        "REDIS_PASSWORD",
        "JWT_SECRET",
        "INTERNAL_TOKEN",
        "AI_SERVICE_URL",
    },
}

for secret_name, expected_keys in expected_secret_keys.items():
    response = aws("secretsmanager", "get-secret-value", "--secret-id", secret_name)
    actual_keys = set(json.loads(response["SecretString"]))
    missing = expected_keys - actual_keys
    if missing:
        raise SystemExit(f"{secret_name} is missing keys: {', '.join(sorted(missing))}")

print("Floci resource and configuration contracts verified.")
PY
