variable "project" { type = string }
variable "environment" { type = string }
variable "name_prefix" { type = string }

variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "allowed_cidr_blocks" { type = list(string) }

variable "engine_version" { type = string }
variable "instance_class" { type = string }
variable "master_username" { type = string }
variable "port" { type = number }

variable "backup_retention_period" { type = number }
variable "deletion_protection" { type = bool }
variable "skip_final_snapshot" { type = bool }

variable "aws_endpoint_url" { type = string }
variable "aws_region" { type = string }

variable "tags" { type = map(string) }
