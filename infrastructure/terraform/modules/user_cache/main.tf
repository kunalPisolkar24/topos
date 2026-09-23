# =============================================================================
# User Cache — ElastiCache Redis (provisioned)
# =============================================================================

resource "random_password" "auth" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "auth_token" {
  name        = "${var.name_prefix}/redis-auth"
  description = "ElastiCache auth token for ${var.name_prefix}"
  tags        = var.tags
}

resource "aws_secretsmanager_secret_version" "auth_token" {
  secret_id     = aws_secretsmanager_secret.auth_token.id
  secret_string = jsonencode({ auth_token = random_password.auth.result })
}

# ---------------------------------------------------------------------------
# Subnet group
# ---------------------------------------------------------------------------

resource "aws_elasticache_subnet_group" "user" {
  name       = "${var.name_prefix}-cache-subnet"
  subnet_ids = var.private_subnet_ids
  tags       = var.tags
}

# ---------------------------------------------------------------------------
# Security group
# ---------------------------------------------------------------------------

resource "aws_security_group" "cache" {
  name        = "${var.name_prefix}-cache-sg"
  description = "User cache access"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# Parameter group (Redis 7)
# ---------------------------------------------------------------------------

resource "aws_elasticache_parameter_group" "redis7" {
  name   = "${var.name_prefix}-redis7"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# Replication group (provisioned)
# Floci's ElastiCache mock creates a primary endpoint. TLS is enabled for
# prod parity; the app uses rediss:// when a token is present.
# ---------------------------------------------------------------------------

resource "aws_elasticache_replication_group" "user" {
  replication_group_id = "${var.name_prefix}-cache"
  description          = "User cache for ${var.project} ${var.environment}"

  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_clusters
  parameter_group_name = aws_elasticache_parameter_group.redis7.name
  subnet_group_name    = aws_elasticache_subnet_group.user.name
  security_group_ids   = [aws_security_group.cache.id]
  port                 = 6379

  automatic_failover_enabled = var.automatic_failover_enabled && var.num_cache_clusters > 1
  multi_az_enabled           = var.multi_az_enabled && var.num_cache_clusters > 1

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.auth.result

  snapshot_retention_limit   = var.snapshot_retention_limit
  apply_immediately          = true
  auto_minor_version_upgrade = true

  tags = var.tags
}
