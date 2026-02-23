#!/bin/sh
set -eu

: "${USER_POSTGRES_USER:?USER_POSTGRES_USER is required}"
: "${USER_POSTGRES_PRIMARY_INT_PORT:?USER_POSTGRES_PRIMARY_INT_PORT is required}"
: "${USER_POSTGRES_REPLICATION_USER:?USER_POSTGRES_REPLICATION_USER is required}"
: "${USER_POSTGRES_REPLICATION_PASSWORD:?USER_POSTGRES_REPLICATION_PASSWORD is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

until pg_isready -h user-postgres-primary -p "${USER_POSTGRES_PRIMARY_INT_PORT}" -U "${USER_POSTGRES_USER}"; do
  sleep 2
done

psql \
  -v ON_ERROR_STOP=1 \
  -h user-postgres-primary \
  -p "${USER_POSTGRES_PRIMARY_INT_PORT}" \
  -U "${USER_POSTGRES_USER}" \
  -d postgres \
  --set=repl_user="${USER_POSTGRES_REPLICATION_USER}" \
  --set=repl_password="${USER_POSTGRES_REPLICATION_PASSWORD}" <<'SQL'
DO
$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'repl_user') THEN
    EXECUTE format('CREATE ROLE %I WITH REPLICATION LOGIN PASSWORD %L', :'repl_user', :'repl_password');
  ELSE
    EXECUTE format('ALTER ROLE %I WITH REPLICATION LOGIN PASSWORD %L', :'repl_user', :'repl_password');
  END IF;
END
$$;
SQL
