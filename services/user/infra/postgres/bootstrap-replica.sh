#!/bin/sh
set -eu

: "${USER_POSTGRES_PRIMARY_INT_PORT:?USER_POSTGRES_PRIMARY_INT_PORT is required}"
: "${USER_POSTGRES_REPLICATION_USER:?USER_POSTGRES_REPLICATION_USER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

if [ ! -f "${PGDATA}/standby.signal" ]; then
  until pg_isready -h user-postgres-primary -p "${USER_POSTGRES_PRIMARY_INT_PORT}" -U "${USER_POSTGRES_REPLICATION_USER}"; do
    echo waiting for primary
    sleep 2
  done

  rm -rf "${PGDATA:?}/"*

  gosu postgres pg_basebackup \
    -h user-postgres-primary \
    -p "${USER_POSTGRES_PRIMARY_INT_PORT}" \
    -U "${USER_POSTGRES_REPLICATION_USER}" \
    -D "${PGDATA}" \
    -R \
    -P

  chown -R postgres:postgres "${PGDATA}"
fi

exec gosu postgres postgres -c hot_standby=on
