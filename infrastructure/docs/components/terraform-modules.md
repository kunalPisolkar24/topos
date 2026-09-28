# Terraform modules

The Terraform root composes reusable modules under `infrastructure/terraform/modules/`.

## User database

The `user_database` module supports a PostgreSQL writer, reader endpoint, and
RDS Proxy. The application can use the proxy while migrations use the direct
writer. It also supports a separate least-privilege AI checkpoint database and
role on the shared instance.

## User cache

The `user_cache` module provides the Redis-compatible cache endpoint and its
auth material. User-service and content-service caching are application
concerns; Terraform owns the managed endpoint and secrets.

## Content database and streaming

The `content_database` module provisions DocumentDB-compatible storage for
content documents. The `content_streaming` module provisions MSK-compatible
Kafka brokers for post and interaction events.

## Environment target

Terraform variables choose a Floci-compatible endpoint or real AWS. The root
Makefile selects `infrastructure/terraform/envs/<ENV>.tfvars`; `ENV=floci` is
the normal emulated target.
