# =============================================================================
# Content Database — DocumentDB (single instance, MongoDB-compatible)
# =============================================================================

resource "random_password" "master" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "master" {
  name        = "${var.name_prefix}/docdb-master"
  description = "DocumentDB master password for ${var.name_prefix}"
  tags        = var.tags
}

resource "aws_secretsmanager_secret_version" "master" {
  secret_id     = aws_secretsmanager_secret.master.id
  secret_string = jsonencode({ username = var.master_username, password = random_password.master.result })
}

# ---------------------------------------------------------------------------
# Subnet group
# ---------------------------------------------------------------------------

resource "aws_docdb_subnet_group" "content" {
  name       = "${var.name_prefix}-docdb-subnet"
  subnet_ids = var.private_subnet_ids
  tags       = var.tags
}

# ---------------------------------------------------------------------------
# Security group — DocumentDB ingress from service CIDRs
# ---------------------------------------------------------------------------

resource "aws_security_group" "docdb" {
  name        = "${var.name_prefix}-docdb-sg"
  description = "Content DocumentDB access"
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
# DocumentDB cluster — single instance for Floci parity, scale later.
# ---------------------------------------------------------------------------

resource "aws_docdb_cluster" "content" {
  cluster_identifier = "${var.name_prefix}-docdb"
  engine             = "docdb"
  engine_version     = var.engine_version
  master_username    = var.master_username
  master_password    = random_password.master.result
  port               = var.port

  # Floci's mock uses "default" subnet group; use it to avoid replacement drift
  # after manual import. Real AWS uses the created subnet group.
  db_subnet_group_name   = var.aws_endpoint_url != "" ? "default" : aws_docdb_subnet_group.content.name
  vpc_security_group_ids = [aws_security_group.docdb.id]

  backup_retention_period = var.backup_retention_period
  deletion_protection     = var.deletion_protection
  skip_final_snapshot     = var.skip_final_snapshot
  apply_immediately       = true

  # Floci's DocDB mock is single-node; real AWS will add writer/reader.
  # TLS is on by default; app uses mongodb:// with ?tls=true&retryWrites=false on real.
  tags = var.tags

  lifecycle {
    # Floci's mock returns default subnet group regardless of config; ignore drift.
    ignore_changes = [db_subnet_group_name]
  }
}

resource "aws_docdb_cluster_instance" "content" {
  count              = 1
  identifier         = "${var.name_prefix}-docdb-0"
  cluster_identifier = aws_docdb_cluster.content.id
  instance_class     = var.instance_class
  engine             = "docdb"

  tags = var.tags

  lifecycle {
    ignore_changes = [cluster_identifier]
  }
}
