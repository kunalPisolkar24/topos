variable "project" { type = string }
variable "environment" { type = string }
variable "name_prefix" { type = string }

variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "allowed_cidr_blocks" { type = list(string) }

variable "engine_version" { type = string }
variable "node_type" { type = string }
variable "num_cache_clusters" { type = number }
variable "automatic_failover_enabled" { type = bool }
variable "multi_az_enabled" { type = bool }
variable "snapshot_retention_limit" { type = number }

variable "aws_endpoint_url" { type = string }
variable "aws_region" { type = string }

variable "tags" { type = map(string) }
