#!/bin/sh
# Second database on the shared instance for the ai checkpointer
# (LangGraph checkpoint store). Runs once on first volume init via
# /docker-entrypoint-initdb.d. Credentials follow the AI_POSTGRES_*
# vars so docker and init stay in sync; the ai stack remaps only the
# host port (5433) to run beside the user stack.
set -eu

AI_USER="${AI_POSTGRES_USER:-ai_checkpointer}"
AI_PASSWORD="${AI_POSTGRES_PASSWORD:-ai_checkpointer_pass}"
AI_DB="${AI_POSTGRES_DB:-ai_checkpoints}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${AI_USER}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${AI_USER}', '${AI_PASSWORD}');
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '${AI_USER}', '${AI_PASSWORD}');
  END IF;
END
\$\$;
SELECT format('CREATE DATABASE %I OWNER %I', '${AI_DB}', '${AI_USER}')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${AI_DB}')\gexec
EOSQL
