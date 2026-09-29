# =============================================================================
# Topos — Secrets Manager (placeholders, populated by seed-secrets or app)
# Real values come from `tools/seed-secrets` after `terraform apply`.
# On Floci this is a mock; on real AWS it holds the connection URLs below.
# Pooled app URLs go through the RDS Proxy (require_tls) with verified TLS;
# migrate/setup URLs stay on the direct writer for DDL.
# =============================================================================

# ---------------------------------------------------------------------------
# User secrets
# ---------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "user_secrets" {
  name        = "topos/user/secrets"
  description = "User service secrets: DATABASE_URL, DATABASE_URL_MIGRATE, AI_CHECKPOINTER_PASSWORD, REDIS_URL, JWT_SECRET"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "user_secrets" {
  secret_id = aws_secretsmanager_secret.user_secrets.id
  secret_string = jsonencode(
    var.environment == "floci" ? {
      # Floci data plane (real, Docker-backed): RDS Postgres is served on
      # the Floci container's proxy port 7001 and ElastiCache/Valkey on
      # 6379 (plaintext + AUTH token at the proxy). The `floci` hostname
      # resolves from app containers on the bridge network (see
      # services/user/infra/compose.prod.yml), so no docker postgres/redis
      # is needed. Real AWS uses the proxy / ElastiCache endpoints below.
      DATABASE_URL         = "postgresql://${var.postgres_username}:${module.user_database.master_password}@floci:7001/${var.postgres_db_name}"
      DATABASE_URL_MIGRATE = "postgresql://${var.postgres_username}:${module.user_database.master_password}@floci:7001/${var.postgres_db_name}"
      # Consumed by the user-migrator runner to bootstrap the AI
      # checkpointer role/database (see services/user/scripts/).
      AI_CHECKPOINTER_PASSWORD = module.user_database.ai_password
      REDIS_URL                = "redis://:${module.user_cache.auth_token}@floci:6379"
      JWT_SECRET               = local.floci_jwt_secret
      } : {
      DATABASE_URL         = "postgresql://${var.postgres_username}:${module.user_database.master_password}@${local.user_db_host}:${var.postgres_port}/${var.postgres_db_name}?sslmode=require"
      DATABASE_URL_MIGRATE = "postgresql://${var.postgres_username}:${module.user_database.master_password}@${module.user_database.writer_endpoint}:${var.postgres_port}/${var.postgres_db_name}?sslmode=require"
      # Lets the user-migrator bootstrap the AI role/database on every
      # deploy (services/user/scripts/bootstrap-ai-db.mjs).
      AI_CHECKPOINTER_PASSWORD = module.user_database.ai_password
      REDIS_URL                = module.user_cache.redis_url
      JWT_SECRET               = random_password.jwt.result
    }
  )

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ---------------------------------------------------------------------------
# AI secrets
# ---------------------------------------------------------------------------
# CHECKPOINT_DB_URL is the pooled runtime URL (proxy); CHECKPOINT_DB_URL_MIGRATE
# is the direct writer URL for saver.setup() DDL. Shared instance, separate
# ai_checkpoints database + least-privilege ai_checkpointer role (created once
# via modules/user_database/init-ai-db.sql).

resource "aws_secretsmanager_secret" "ai_secrets" {
  name        = "topos/ai/secrets"
  description = "AI service secrets: CHECKPOINT_DB_URL, CHECKPOINT_DB_URL_MIGRATE"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "ai_secrets" {
  secret_id = aws_secretsmanager_secret.ai_secrets.id
  secret_string = jsonencode(
    var.environment == "floci" ? {
      # Floci data plane (real, Docker-backed): the shared RDS instance
      # serves ai_checkpoints on the Floci proxy port 7001 (plaintext).
      # Checkpoint traffic never needs a pooler; direct writer URL for both.
      CHECKPOINT_DB_URL         = "postgresql://${module.user_database.ai_username}:${module.user_database.ai_password}@floci:7001/${module.user_database.ai_db_name}"
      CHECKPOINT_DB_URL_MIGRATE = "postgresql://${module.user_database.ai_username}:${module.user_database.ai_password}@floci:7001/${module.user_database.ai_db_name}"
      } : {
      CHECKPOINT_DB_URL         = "postgresql://${module.user_database.ai_username}:${module.user_database.ai_password}@${local.user_db_host}:${var.postgres_port}/${module.user_database.ai_db_name}?sslmode=require"
      CHECKPOINT_DB_URL_MIGRATE = "postgresql://${module.user_database.ai_username}:${module.user_database.ai_password}@${module.user_database.writer_endpoint}:${var.postgres_port}/${module.user_database.ai_db_name}?sslmode=require"
    }
  )

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ---------------------------------------------------------------------------
# Content secrets
# ---------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "content_secrets" {
  name        = "topos/content/secrets"
  description = "Content service secrets: MONGO_URI, KAFKA_BROKERS, REDIS_ADDR, JWT_SECRET, INTERNAL_TOKEN"

  tags = local.content_tags
}

resource "aws_secretsmanager_secret_version" "content_secrets" {
  secret_id = aws_secretsmanager_secret.content_secrets.id
  secret_string = jsonencode(
    var.environment == "floci" ? {
      # Floci data plane (real, Docker-backed): DocumentDB (Mongo 7) and
      # MSK (Redpanda, Kafka protocol) run as Floci sidecars. DocDB is
      # reached by its stable sidecar name; MSK advertises its container
      # hostname, so KAFKA_BROKERS pins the current sidecar name (changes
      # only if the cluster is recreated — then re-apply refreshes this).
      # Redis goes via the Floci proxy (plaintext + AUTH token). App
      # containers must share the `floci-apps` network with these sidecars
      # (see services/content/infra/compose.prod.yml). No docker
      # mongo/kafka/redis needed. Real AWS uses the cluster endpoints below.
      MONGO_URI      = "mongodb://${var.docdb_master_username}:${module.content_database.master_password}@floci-docdb-topos-content-floci-docdb:27017/blog_content?authSource=admin"
      KAFKA_BROKERS  = "floci-msk-ecac64:9092"
      REDIS_ADDR     = "floci:6379"
      REDIS_PASSWORD = module.user_cache.auth_token
      JWT_SECRET     = local.floci_jwt_secret
      INTERNAL_TOKEN = local.floci_internal_token
      AI_SERVICE_URL = "ai-service:50051"
      } : {
      # DocumentDB requires TLS and does not support retryable writes.
      MONGO_URI      = "mongodb://${var.docdb_master_username}:${module.content_database.master_password}@${module.content_database.cluster_endpoint}:${var.docdb_port}/blog_content?tls=true&tlsCAFile=/app/certs/rds-combined-ca-bundle.pem&retryWrites=false"
      KAFKA_BROKERS  = module.content_streaming.bootstrap_brokers
      REDIS_ADDR     = "user-redis:6379"
      REDIS_PASSWORD = ""
      JWT_SECRET     = random_password.jwt.result
      INTERNAL_TOKEN = random_password.internal_token.result
      AI_SERVICE_URL = "ai-service:50051"
    }
  )

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "random_password" "internal_token" {
  length  = 64
  special = false
}
