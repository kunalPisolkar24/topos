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

variable "aws_endpoint_url" { type = string }
variable "aws_region" { type = string }

variable "tags" { type = map(string) }
