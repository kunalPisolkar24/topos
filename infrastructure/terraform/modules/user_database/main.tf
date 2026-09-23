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

resource "aws_security_group" "db" {
  name        = "${var.name_prefix}-db-sg"
  description = "User DB access"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = var.port
    to_port     = var.port
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
# Parameter group
# ---------------------------------------------------------------------------

resource "aws_db_parameter_group" "postgres16" {
  name   = "${var.name_prefix}-pg16"
  family = "postgres16"

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
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

  allocated_storage      = var.allocated_storage
  storage_type           = "gp3"
  storage_encrypted      = true
  db_name                = var.db_name
  username               = var.username
  password               = random_password.master.result
  port                   = var.port
  parameter_group_name   = aws_db_parameter_group.postgres16.name
  db_subnet_group_name   = aws_db_subnet_group.user.name
  vpc_security_group_ids = [aws_security_group.db.id]

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
# RDS Proxy — connection pooling for the app (DATABASE_URL)
# On Floci this is mocked; on real AWS it requires IAM role + Secrets Manager.
# We create the proxy only when not on Floci, to avoid Floci apply failures.
# Floci's RDS proxy is not fully emulated; the app will still use the writer
# endpoint directly when proxy_endpoint is empty, which is fine for testing.
# ---------------------------------------------------------------------------

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "proxy" {
  count = var.aws_endpoint_url == "" ? 1 : 0

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
  count = var.aws_endpoint_url == "" ? 1 : 0

  name = "${var.name_prefix}-proxy-secrets"
  role = aws_iam_role.proxy[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.master.arn
    }]
  })
}

resource "aws_db_proxy" "user" {
  count = var.aws_endpoint_url == "" ? 1 : 0

  name                   = "${var.name_prefix}-proxy"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.proxy[0].arn
  vpc_subnet_ids         = var.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.db.id]
  require_tls            = true
  idle_client_timeout    = 1800

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.master.arn
  }

  tags = var.tags
}

resource "aws_db_proxy_default_target_group" "user" {
  count = var.aws_endpoint_url == "" ? 1 : 0

  db_proxy_name = aws_db_proxy.user[0].name

  connection_pool_config {
    max_connections_percent      = 100
    max_idle_connections_percent = 50
    connection_borrow_timeout    = 120
  }
}

resource "aws_db_proxy_target" "user" {
  count = var.aws_endpoint_url == "" ? 1 : 0

  db_proxy_name          = aws_db_proxy.user[0].name
  target_group_name      = aws_db_proxy_default_target_group.user[0].name
  db_instance_identifier = aws_db_instance.user.identifier
}
