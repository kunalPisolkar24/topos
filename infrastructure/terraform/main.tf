# =============================================================================
# Topos — User + Content infrastructure
# User: RDS Postgres + Proxy + ElastiCache Redis
# Content: DocumentDB + MSK (single instance/broker on Floci)
# Floci is the primary target; real AWS is a drop-in via endpoint/backend swap.
# =============================================================================

locals {
  common_tags = merge({
    Project     = var.project
    Environment = var.environment
    Service     = "user"
    ManagedBy   = "terraform"
  }, var.tags)

  is_floci = var.aws_endpoint_url != ""

  content_name_prefix = "${var.project}-content-${var.environment}"
  content_tags        = merge(local.common_tags, { Service = "content" })
}

# ---------------------------------------------------------------------------
# Data: default VPC/subnets (Floci) — only used when vpc_id is default.
# For real AWS, pass explicit subnet IDs via tfvars.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# User Database — RDS Postgres + Proxy
# ---------------------------------------------------------------------------

module "user_database" {
  source = "./modules/user_database"

  project     = var.project
  environment = var.environment
  name_prefix = var.name_prefix

  vpc_id              = var.vpc_id
  private_subnet_ids  = var.private_subnet_ids
  allowed_cidr_blocks = var.allowed_cidr_blocks

  engine_version          = var.postgres_engine_version
  instance_class          = var.postgres_instance_class
  allocated_storage       = var.postgres_allocated_storage
  multi_az                = var.postgres_multi_az
  deletion_protection     = var.postgres_deletion_protection
  backup_retention_period = var.postgres_backup_retention_period
  db_name                 = var.postgres_db_name
  username                = var.postgres_username
  port                    = var.postgres_port

  aws_endpoint_url = var.aws_endpoint_url
  aws_region       = var.aws_region

  tags = local.common_tags
}

# ---------------------------------------------------------------------------
# User Cache — ElastiCache Redis (provisioned)
# ---------------------------------------------------------------------------

module "user_cache" {
  source = "./modules/user_cache"

  project     = var.project
  environment = var.environment
  name_prefix = var.name_prefix

  vpc_id              = var.vpc_id
  private_subnet_ids  = var.private_subnet_ids
  allowed_cidr_blocks = var.allowed_cidr_blocks

  engine_version             = var.redis_engine_version
  node_type                  = var.redis_node_type
  num_cache_clusters         = var.redis_num_cache_clusters
  automatic_failover_enabled = var.redis_automatic_failover_enabled
  multi_az_enabled           = var.redis_multi_az_enabled
  snapshot_retention_limit   = var.redis_snapshot_retention_limit

  aws_endpoint_url = var.aws_endpoint_url
  aws_region       = var.aws_region

  tags = local.common_tags
}

# ---------------------------------------------------------------------------
# Content Database — DocumentDB (MongoDB-compatible, single instance on Floci)
# ---------------------------------------------------------------------------

module "content_database" {
  source = "./modules/content_database"

  project     = var.project
  environment = var.environment
  name_prefix = local.content_name_prefix

  vpc_id              = var.vpc_id
  private_subnet_ids  = var.private_subnet_ids
  allowed_cidr_blocks = var.allowed_cidr_blocks

  engine_version          = var.docdb_engine_version
  instance_class          = var.docdb_instance_class
  master_username         = var.docdb_master_username
  port                    = var.docdb_port
  backup_retention_period = var.docdb_backup_retention_period
  deletion_protection     = var.docdb_deletion_protection
  skip_final_snapshot     = var.docdb_skip_final_snapshot

  aws_endpoint_url = var.aws_endpoint_url
  aws_region       = var.aws_region

  tags = local.content_tags
}

# ---------------------------------------------------------------------------
# Content Streaming — MSK (single broker on Floci)
# ---------------------------------------------------------------------------

module "content_streaming" {
  source = "./modules/content_streaming"

  project     = var.project
  environment = var.environment
  name_prefix = local.content_name_prefix

  vpc_id              = var.vpc_id
  private_subnet_ids  = var.private_subnet_ids
  allowed_cidr_blocks = var.allowed_cidr_blocks

  kafka_version          = var.msk_kafka_version
  instance_type          = var.msk_instance_type
  number_of_broker_nodes = var.msk_number_of_broker_nodes
  ebs_volume_size        = var.msk_ebs_volume_size

  aws_endpoint_url = var.aws_endpoint_url
  aws_region       = var.aws_region

  tags = local.content_tags
}

# ---------------------------------------------------------------------------
# SSM Parameter Store — user config (non-secret)
# ---------------------------------------------------------------------------

resource "aws_ssm_parameter" "user_config" {
  name = "/topos/user/config"
  type = "String"
  value = jsonencode({
    PORT                       = "4001"
    LOG_LEVEL                  = "info"
    OTEL_SERVICE_NAME          = "user-service"
    JWT_ISSUER                 = "user-service"
    JWT_AUDIENCE               = "topos"
    JWT_EXPIRES_IN             = "7d"
    REDIS_CACHE_TTL_MS         = "3600000"
    REDIS_MISSING_CACHE_TTL_MS = "60000"
  })
  description = "User service non-secret config"
  tags        = local.common_tags

  # Floci's SSM is in-memory; no KMS.
}

# ---------------------------------------------------------------------------
# Secrets Manager — user secrets (placeholder, populated by seed-secrets or app)
# Real values come from `tools/seed-secrets` after `terraform apply`.
# On Floci this is a mock; on real AWS it holds DATABASE_URL, REDIS_URL, JWT_SECRET.
# ---------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "user_secrets" {
  name        = "topos/user/secrets"
  description = "User service secrets: DATABASE_URL, DATABASE_URL_MIGRATE, REDIS_URL, JWT_SECRET"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "user_secrets" {
  secret_id = aws_secretsmanager_secret.user_secrets.id
  secret_string = jsonencode(
    var.environment == "floci" ? {
      # Floci: point at the docker compose services so the container can actually connect.
      # The mocked RDS/ElastiCache endpoints (172.18.0.2:7001, localhost:6379) are not
      # reachable from the app network; use the real docker service names on app-network.
      DATABASE_URL         = "postgresql://topos_user:topos_pass@user-postgres:5432/topos_users"
      DATABASE_URL_MIGRATE = "postgresql://topos_user:topos_pass@user-postgres:5432/topos_users"
      REDIS_URL            = "redis://user-redis:6379"
      JWT_SECRET           = "floci-jwt-secret-0123456789abcdef0123456789abcdef-floci"
      } : {
      DATABASE_URL = (
        try(coalesce(module.user_database.proxy_endpoint, ""), "") != ""
        ? "postgresql://${var.postgres_username}:${module.user_database.master_password}@${module.user_database.proxy_endpoint}:${var.postgres_port}/${var.postgres_db_name}"
        : "postgresql://${var.postgres_username}:${module.user_database.master_password}@${module.user_database.writer_endpoint}:${var.postgres_port}/${var.postgres_db_name}"
      )
      DATABASE_URL_MIGRATE = "postgresql://${var.postgres_username}:${module.user_database.master_password}@${module.user_database.writer_endpoint}:${var.postgres_port}/${var.postgres_db_name}"
      REDIS_URL            = module.user_cache.redis_url
      JWT_SECRET           = random_password.jwt.result
    }
  )

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ---------------------------------------------------------------------------
# SSM Parameter Store — content config (non-secret)
# ---------------------------------------------------------------------------

resource "aws_ssm_parameter" "content_config" {
  name = "/topos/content/config"
  type = "String"
  value = jsonencode({
    PORT                                 = "4002"
    DB_NAME                              = "blog_content"
    LOG_LEVEL                            = "info"
    LOG_FORMAT                           = "json"
    OTEL_SERVICE_NAME                    = "content-service"
    JWT_ISSUER                           = "user-service"
    JWT_AUDIENCE                         = "topos"
    KAFKA_TOPIC                          = "posts"
    KAFKA_USER_INTERACTED_TOPIC          = "user-interacted"
    KAFKA_DLQ_TOPIC                      = "posts-dlq"
    KAFKA_CONSUMER_GROUP_ID              = "content-summary-worker-group"
    KAFKA_SEARCH_CONSUMER_GROUP_ID       = "content-search-worker-group"
    KAFKA_PERSONALIZER_CONSUMER_GROUP_ID = "content-personalizer-worker-group"
    WORKER_CONCURRENCY                   = "3"
  })
  description = "Content service non-secret config"
  tags        = local.content_tags
}

# ---------------------------------------------------------------------------
# Secrets Manager — content secrets
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
      MONGO_URI      = "mongodb://content-mongo:27017"
      KAFKA_BROKERS  = "kafka-1:9092"
      REDIS_ADDR     = "user-redis:6379"
      DB_NAME        = "blog_content"
      JWT_SECRET     = "floci-jwt-secret-0123456789abcdef0123456789abcdef-floci"
      INTERNAL_TOKEN = "floci-internal-secret-0123456789abcdef0123456789abcdef-floci"
      AI_SERVICE_URL = "ai-service:50051"
      } : {
      MONGO_URI = (
        try(coalesce(module.content_database.cluster_endpoint, ""), "") != ""
        ? "mongodb://${var.docdb_master_username}:${module.content_database.master_password}@${module.content_database.cluster_endpoint}:${var.docdb_port}/blog_content?tls=true&tlsCAFile=/app/certs/rds-combined-ca-bundle.pem&retryWrites=false"
        : "mongodb://${var.docdb_master_username}:${module.content_database.master_password}@${module.content_database.cluster_endpoint}:${var.docdb_port}/blog_content"
      )
      KAFKA_BROKERS  = try(coalesce(module.content_streaming.bootstrap_brokers, ""), "kafka-1:9092")
      REDIS_ADDR     = "user-redis:6379"
      DB_NAME        = "blog_content"
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
