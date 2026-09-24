variable "project" { type = string }
variable "environment" { type = string }
variable "name_prefix" { type = string }

variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "allowed_cidr_blocks" { type = list(string) }

variable "engine_version" { type = string }
variable "instance_class" { type = string }
variable "allocated_storage" { type = number }
variable "multi_az" { type = bool }
variable "deletion_protection" { type = bool }
variable "backup_retention_period" { type = number }
variable "db_name" { type = string }
variable "username" { type = string }
variable "port" { type = number }

# Second database on the shared instance for the ai checkpointer
# (LangGraph checkpoint store). The role/database itself is created once
# via init-ai-db.sql against the writer endpoint (the AWS provider cannot
# create extra databases); Terraform manages the password secret + proxy auth.
variable "ai_db_name" {
  description = "AI checkpoint database name on the shared instance"
  type        = string
  default     = "ai_checkpoints"
}

variable "ai_username" {
  description = "AI checkpoint database username"
  type        = string
  default     = "ai_checkpointer"
}

# RDS Proxy tuning. Defaults mirror the current production behavior;
# max_connections_percent=100 shares the whole instance budget with the
# single target (one RDS instance, two databases).
variable "proxy_require_tls" {
  description = "Require TLS on proxy client connections"
  type        = bool
  default     = true
}

variable "proxy_idle_client_timeout" {
  description = "Proxy idle client timeout in seconds"
  type        = number
  default     = 1800
}

variable "proxy_max_connections_percent" {
  description = "Max pooled connections as percent of instance max_connections"
  type        = number
  default     = 100
}

variable "proxy_max_idle_connections_percent" {
  description = "Max idle pooled connections as percent of instance max_connections"
  type        = number
  default     = 50
}

variable "proxy_connection_borrow_timeout" {
  description = "Proxy borrow timeout in seconds"
  type        = number
  default     = 120
}

variable "aws_endpoint_url" { type = string }
variable "aws_region" { type = string }

variable "tags" { type = map(string) }
