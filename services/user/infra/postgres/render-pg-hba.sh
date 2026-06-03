#!/bin/sh
set -eu

: "${USER_POSTGRES_REPLICATION_USER:?USER_POSTGRES_REPLICATION_USER is required}"
: "${USER_POSTGRES_REPLICATION_CIDR:?USER_POSTGRES_REPLICATION_CIDR is required}"

app_cidr="${USER_POSTGRES_APP_CIDR:-172.18.0.0/16}"

sed \
  -e "s|__APP_CIDR__|${app_cidr}|g" \
  -e "s|__REPLICATION_USER__|${USER_POSTGRES_REPLICATION_USER}|g" \
  -e "s|__REPLICATION_CIDR__|${USER_POSTGRES_REPLICATION_CIDR}|g" \
  /etc/postgresql/pg_hba.conf.template > /etc/postgresql/pg_hba.conf

chown postgres:postgres /etc/postgresql/pg_hba.conf
chmod 600 /etc/postgresql/pg_hba.conf
