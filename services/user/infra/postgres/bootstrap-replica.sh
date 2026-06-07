#!/bin/sh
set -eu

: "${USER_POSTGRES_PRIMARY_INT_PORT:?USER_POSTGRES_PRIMARY_INT_PORT is required}"
: "${USER_POSTGRES_REPLICATION_USER:?USER_POSTGRES_REPLICATION_USER is required}"
: "${USER_POSTGRES_REPLICATION_PASSWORD:?USER_POSTGRES_REPLICATION_PASSWORD is required}"

mkdir -p "${PGDATA}"
chown postgres:postgres "${PGDATA}"
chmod 700 "${PGDATA}"

if [ ! -f "${PGDATA}/standby.signal" ]; then
  until PGPASSWORD="${USER_POSTGRES_REPLICATION_PASSWORD}" pg_isready -h user-postgres-primary -p "${USER_POSTGRES_PRIMARY_INT_PORT}" -U "${USER_POSTGRES_REPLICATION_USER}"; do
    echo waiting for primary
    sleep 2
  done

  rm -rf "${PGDATA:?}/"*

  PGPASSWORD="${USER_POSTGRES_REPLICATION_PASSWORD}" gosu postgres pg_basebackup \
    -h user-postgres-primary \
    -p "${USER_POSTGRES_PRIMARY_INT_PORT}" \
    -U "${USER_POSTGRES_REPLICATION_USER}" \
    -D "${PGDATA}" \
    -R \
    -P
fi

chown -R postgres:postgres "${PGDATA}"
chmod 700 "${PGDATA}"

exec gosu postgres postgres -c hot_standby=on
