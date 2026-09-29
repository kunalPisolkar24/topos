# =============================================================================
# User Database — RDS Postgres + Proxy
# =============================================================================

resource "random_password" "master" {
  length  = 32
  special = false
}

# ---------------------------------------------------------------------------
# Secrets Manager — master password (Floci: mock, Real: KMS encrypted)
# The RDS master secret is also stored here for app use. On Floci it's a plain
# SM secret; on real AWS it would be managed via `manage_master_user_password`.
# ---------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "master" {
  name        = "${var.name_prefix}/master"
  description = "RDS master password for ${var.name_prefix}"
  tags        = var.tags
}

resource "aws_secretsmanager_secret_version" "master" {
  secret_id     = aws_secretsmanager_secret.master.id
  secret_string = jsonencode({ username = var.username, password = random_password.master.result })
}

# ---------------------------------------------------------------------------
# AI checkpointer credentials — least-privilege role for the second
# database (ai_checkpoints) on the shared instance. The role/database are
# created once via init-ai-db.sql against the writer endpoint; the password
# lives here so the proxy can authenticate AI connections. Add this secret
# name to TF_MANAGED_SECRETS in tools/seed-secrets (seed must not rotate it).
# ---------------------------------------------------------------------------

resource "random_password" "ai" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "ai" {
  name        = "${var.name_prefix}/ai-checkpointer"
  description = "AI checkpointer password for ${var.name_prefix}"
  tags        = var.tags
}

resource "aws_secretsmanager_secret_version" "ai" {
  secret_id     = aws_secretsmanager_secret.ai.id
  secret_string = jsonencode({ username = var.ai_username, password = random_password.ai.result })
}

# ---------------------------------------------------------------------------
# Subnet group
# ---------------------------------------------------------------------------

resource "aws_db_subnet_group" "user" {
  name       = "${var.name_prefix}-subnet-group"
  subnet_ids = var.private_subnet_ids
  tags       = var.tags
}

# ---------------------------------------------------------------------------
# Security group — Postgres ingress from service CIDRs
# ---------------------------------------------------------------------------

module "security_group" {
  source = "../security_group"

  name                = "${var.name_prefix}-db-sg"
  description         = "User DB access"
  vpc_id              = var.vpc_id
  allowed_cidr_blocks = var.allowed_cidr_blocks
  ingress_rules = [{
    from_port = var.is_floci ? 7001 : var.port
    to_port   = var.is_floci ? 7001 : var.port
    protocol  = "tcp"
  }]
  tags = var.tags
}

# ---------------------------------------------------------------------------
# Parameter group
# ---------------------------------------------------------------------------

resource "aws_db_parameter_group" "postgres16" {
  name   = "${var.name_prefix}-pg16"
  family = "postgres16"

  # Floci accepts the group but does not persist individual parameters.
  # Keep the real-AWS diagnostic setting without creating an emulator diff.
  dynamic "parameter" {
    for_each = var.is_floci ? [] : [true]

    content {
      name  = "log_min_duration_statement"
      value = "1000"
    }
  }

  tags = var.tags
}

# ---------------------------------------------------------------------------
# RDS instance
# ---------------------------------------------------------------------------

resource "aws_db_instance" "user" {
  identifier     = "${var.name_prefix}-db"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage = var.allocated_storage
  # Floci exposes its Docker-backed RDS storage as gp2 and its data-plane
  # proxy on 7001. Real AWS continues to use gp3 and the configured port.
  storage_type           = var.is_floci ? "gp2" : "gp3"
  storage_encrypted      = true
  db_name                = var.db_name
  username               = var.username
  password               = random_password.master.result
  port                   = var.is_floci ? 7001 : var.port
  parameter_group_name   = aws_db_parameter_group.postgres16.name
  db_subnet_group_name   = aws_db_subnet_group.user.name
  vpc_security_group_ids = [module.security_group.id]

  multi_az                  = var.multi_az
  deletion_protection       = var.deletion_protection
  backup_retention_period   = var.backup_retention_period
  backup_window             = "03:00-04:00"
  maintenance_window        = "sun:04:30-sun:05:30"
  copy_tags_to_snapshot     = true
  delete_automated_backups  = true
  skip_final_snapshot       = var.environment == "floci" ? true : false
  final_snapshot_identifier = var.environment == "floci" ? null : "${var.name_prefix}-final-${var.environment}"

  performance_insights_enabled = var.environment == "prod" ? true : false

  tags = var.tags
}

# ---------------------------------------------------------------------------
# RDS Proxy — connection pooling for the app (DATABASE_URL / CHECKPOINT_DB_URL)
# One instance, two databases (topos_users + ai_checkpoints); the proxy
# routes by username via its two auth entries. App still falls back to the
# writer when proxy_endpoint is empty (main.tf user/ai secrets logic).
# ---------------------------------------------------------------------------

resource "aws_iam_role" "proxy" {
  name = "${var.name_prefix}-proxy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "proxy_secrets" {
  name = "${var.name_prefix}-proxy-secrets"
  role = aws_iam_role.proxy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.master.arn,
        aws_secretsmanager_secret.ai.arn,
      ]
    }]
  })
}

resource "aws_db_proxy" "user" {
  name                   = "${var.name_prefix}-proxy"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.proxy.arn
  vpc_subnet_ids         = var.private_subnet_ids
  vpc_security_group_ids = [module.security_group.id]
  require_tls            = var.proxy_require_tls
  idle_client_timeout    = var.proxy_idle_client_timeout

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.master.arn
  }

  # Second auth entry so the proxy can authenticate the ai_checkpointer
  # role (separate database, least privilege). The proxy routes by
  # username in the connection string.
  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.ai.arn
  }

  tags = var.tags
}

resource "aws_db_proxy_default_target_group" "user" {
  db_proxy_name = aws_db_proxy.user.name

  connection_pool_config {
    max_connections_percent      = var.proxy_max_connections_percent
    max_idle_connections_percent = var.proxy_max_idle_connections_percent
    connection_borrow_timeout    = var.proxy_connection_borrow_timeout
  }
}

resource "aws_db_proxy_target" "user" {
  db_proxy_name          = aws_db_proxy.user.name
  target_group_name      = aws_db_proxy_default_target_group.user.name
  db_instance_identifier = aws_db_instance.user.identifier
}
