#!/bin/sh
set -eu

/usr/local/bin/render-pg-hba.sh

exec docker-entrypoint.sh \
  postgres \
  -c wal_level=replica \
  -c hot_standby=on \
  -c max_wal_senders=10 \
  -c max_replication_slots=10 \
  -c hot_standby_feedback=on \
  -c hba_file=/etc/postgresql/pg_hba.conf
