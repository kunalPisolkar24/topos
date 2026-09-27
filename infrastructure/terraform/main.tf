# =============================================================================
# Topos — User + Content infrastructure
# User: RDS Postgres + Proxy + ElastiCache Redis
# Content: DocumentDB + MSK (single instance/broker on Floci)
# Floci is the primary target; real AWS is a drop-in via endpoint/backend swap.
#
# Layout: main.tf (module wiring) + config.tf (SSM params) + secrets.tf
# (Secrets Manager). Service config lives in config.tf; secrets in secrets.tf.
# =============================================================================

locals {
  base_tags = {
    Project   = var.project
    ManagedBy = "terraform"
  }

  common_tags = merge(var.tags, local.base_tags, {
    Environment = var.environment
    Service     = "user"
  })

  # Placeholder secret for Floci-only URLs. Real AWS uses random_password
  # values (see secrets.tf). Single source so user and content stacks stay
  # in sync.
  floci_jwt_secret     = "floci-jwt-secret-0123456789abcdef0123456789abcdef-floci"
  floci_internal_token = "floci-internal-secret-0123456789abcdef0123456789abcdef-floci"

  content_name_prefix = "${var.project}-content-${var.environment}"
  content_tags        = merge(var.tags, local.base_tags, { Environment = var.environment, Service = "content" })

  # Pooled app host: proxy endpoint when present, direct writer otherwise.
  # Single source for the DATABASE_URL / CHECKPOINT_DB_URL templates in
  # secrets.tf (previously the same try/coalesce repeated per secret).
  user_db_host = try(coalesce(module.user_database.proxy_endpoint, ""), "") != "" ? module.user_database.proxy_endpoint : module.user_database.writer_endpoint
}

# ---------------------------------------------------------------------------
# User Database — RDS Postgres + Proxy
# ---------------------------------------------------------------------------

module "user_database" {
  source = "./modules/user_database"

  environment = var.environment
  is_floci    = var.aws_endpoint_url != ""
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

  tags = local.common_tags
}

# ---------------------------------------------------------------------------
# User Cache — ElastiCache Redis (provisioned)
# ---------------------------------------------------------------------------

module "user_cache" {
  source = "./modules/user_cache"

  project     = var.project
  environment = var.environment
  is_floci    = var.aws_endpoint_url != ""
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

  tags = local.common_tags
}

# ---------------------------------------------------------------------------
# Content Database — DocumentDB (MongoDB-compatible, single instance on Floci)
# ---------------------------------------------------------------------------

module "content_database" {
  source = "./modules/content_database"

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

  tags = local.content_tags
}

# ---------------------------------------------------------------------------
# Content Streaming — MSK (single broker on Floci)
# ---------------------------------------------------------------------------

module "content_streaming" {
  source = "./modules/content_streaming"

  name_prefix = local.content_name_prefix

  vpc_id              = var.vpc_id
  private_subnet_ids  = var.private_subnet_ids
  allowed_cidr_blocks = var.allowed_cidr_blocks

  kafka_version          = var.msk_kafka_version
  instance_type          = var.msk_instance_type
  number_of_broker_nodes = var.msk_number_of_broker_nodes
  ebs_volume_size        = var.msk_ebs_volume_size

  aws_endpoint_url = var.aws_endpoint_url

  tags = local.content_tags
}
