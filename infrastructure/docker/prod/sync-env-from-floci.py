"""Sync infrastructure/docker/prod/.env connection strings from Floci.

Pulls DATABASE/REDIS/MONGO URLs and passwords from Secrets Manager
(topos/user, topos/ai, topos/content secrets) and discovers the live
MSK/DocDB sidecar hostnames via `docker ps`. JWT, Qdrant, LLM, and frontend
keys are preserved.

Logs only hostnames and change flags, never secret values.
"""

import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import sys

SYNC_KEYS = (
    "USER_DATABASE_URL",
    "USER_DATABASE_URL_MIGRATE",
    "USER_REDIS_URL",
    "USER_AI_CHECKPOINTER_PASSWORD",
    "AI_CHECKPOINT_DB_URL",
    "AI_CHECKPOINT_DB_URL_MIGRATE",
    "CONTENT_MONGO_URI",
    "REDIS_PASSWORD",
    "KAFKA_BROKERS",
)


def run(cmd):
    return subprocess.check_output(cmd, text=True)


def get_secret(name, endpoint_url, region):
    out = run(
        [
            "aws",
            "secretsmanager",
            "get-secret-value",
            "--secret-id",
            name,
            "--endpoint-url",
            endpoint_url,
            "--region",
            region,
        ]
    )
    return json.loads(json.loads(out)["SecretString"])


def msk_sidecar():
    names = run(["docker", "ps", "--format", "{{.Names}}"]).split()
    found = sorted(
        n for n in names if n.startswith("floci-msk-") or n.startswith("floci-aws-msk-")
    )
    if not found:
        return None
    if len(found) > 1:
        sys.exit(f"ambiguous MSK sidecars: {', '.join(found)}")
    return f"{found[0]}:9092"


def docdb_sidecar():
    names = run(["docker", "ps", "--format", "{{.Names}}"]).split()
    found = sorted(
        n
        for n in names
        if n.startswith("floci-docdb-") or n.startswith("floci-aws-docdb-")
    )
    if not found:
        return None
    if len(found) > 1:
        sys.exit(f"ambiguous DocDB sidecars: {', '.join(found)}")
    return found[0]


def with_host(value, host):
    return re.sub(r"@[^/?]+", f"@{host}", value, count=1) if value else value


def short_hash(value):
    return hashlib.sha256(value.encode()).hexdigest()[:8]


def host_of(value):
    match = re.search(r"@([^/:?]+)", value or "")
    if match:
        return match.group(1)
    return "SET" if value else "EMPTY"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", required=True)
    parser.add_argument("--endpoint-url", default="http://localhost:4566")
    parser.add_argument("--region", default="ap-south-1")
    args = parser.parse_args()

    env_path = pathlib.Path(args.env_file)
    if not env_path.is_file():
        sys.exit(f"missing env file: {env_path}")

    user_secrets = get_secret("topos/user/secrets", args.endpoint_url, args.region)
    ai_secrets = get_secret("topos/ai/secrets", args.endpoint_url, args.region)
    content_secrets = get_secret("topos/content/secrets", args.endpoint_url, args.region)

    # Floci sidecar hostnames change on cluster recreate (MSK hash suffix)
    # and carry the floci-aws- prefix live, while SM holds placeholders.
    # Discover the live names; fall back to SM with a warning so secret
    # rotation still syncs even when Docker is unreachable.
    broker = msk_sidecar()
    if broker is None:
        print(
            "warning: no live MSK sidecar found, keeping SM KAFKA_BROKERS "
            "(run make infra-up ENV=floci first)",
            file=sys.stderr,
        )
        broker = content_secrets["KAFKA_BROKERS"]
    docdb_host = docdb_sidecar()
    if docdb_host is None:
        print(
            "warning: no live DocDB sidecar found, keeping SM MONGO_URI "
            "(run make infra-up ENV=floci first)",
            file=sys.stderr,
        )
        mongo_uri = content_secrets["MONGO_URI"]
    else:
        mongo_uri = with_host(content_secrets["MONGO_URI"], f"{docdb_host}:27017")

    updates = {
        "USER_DATABASE_URL": user_secrets["DATABASE_URL"],
        "USER_DATABASE_URL_MIGRATE": user_secrets["DATABASE_URL_MIGRATE"],
        "USER_REDIS_URL": user_secrets["REDIS_URL"],
        "USER_AI_CHECKPOINTER_PASSWORD": user_secrets["AI_CHECKPOINTER_PASSWORD"],
        "AI_CHECKPOINT_DB_URL": ai_secrets["CHECKPOINT_DB_URL"],
        "AI_CHECKPOINT_DB_URL_MIGRATE": ai_secrets["CHECKPOINT_DB_URL_MIGRATE"],
        "CONTENT_MONGO_URI": mongo_uri,
        "REDIS_PASSWORD": content_secrets.get("REDIS_PASSWORD", ""),
        "KAFKA_BROKERS": broker,
    }

    previous = {}
    for line in env_path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        previous[key.strip()] = value.strip()

    lines = []
    for line in env_path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            lines.append(line)
            continue
        key, _ = stripped.split("=", 1)
        key = key.strip()
        lines.append(f"{key}={updates[key]}" if key in updates else line)
    env_path.write_text("\n".join(lines) + "\n")

    for key in SYNC_KEYS:
        changed = short_hash(previous.get(key, "")) != short_hash(updates[key])
        print(f"{key} host={host_of(updates[key])} changed={changed}")


if __name__ == "__main__":
    main()
