variable "project" {
  description = "Project name"
  type        = string
  default     = "topos"
}

variable "environment" {
  description = "Environment (floci, dev, prod)"
  type        = string
  default     = "floci"

  validation {
    condition     = contains(["floci", "dev", "prod"], var.environment)
    error_message = "environment must be floci, dev, or prod."
  }
}

variable "vpc_id" {
  description = "VPC ID for user resources"
  type        = string
  default     = "vpc-default-ap-south-1"
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for RDS and ElastiCache"
  type        = list(string)
  default     = ["subnet-default-ap-south-1-a", "subnet-default-ap-south-1-b"]
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access user DB and cache (service subnets)"
  type        = list(string)
  default     = ["172.31.0.0/16"]
}

# RDS
variable "postgres_engine_version" {
  description = "Postgres engine version"
  type        = string
  default     = "16.3"
}

variable "postgres_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "postgres_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "postgres_multi_az" {
  description = "Enable Multi-AZ"
  type        = bool
  default     = false
}

variable "postgres_deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false
}

variable "postgres_backup_retention_period" {
  description = "Backup retention in days"
  type        = number
  default     = 1
}

variable "postgres_db_name" {
  description = "Initial database name"
  type        = string
  default     = "topos_users"
}

variable "postgres_username" {
  description = "Master username"
  type        = string
  default     = "topos_user"
}

variable "postgres_port" {
  description = "Postgres port"
  type        = number
  default     = 5432
}

# ElastiCache
variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_num_cache_clusters" {
  description = "Number of cache clusters (1 = single, 2 = with replica)"
  type        = number
  default     = 1
}

variable "redis_automatic_failover_enabled" {
  description = "Enable automatic failover (requires 2+ clusters)"
  type        = bool
  default     = false
}

variable "redis_multi_az_enabled" {
  description = "Enable Multi-AZ"
  type        = bool
  default     = false
}

variable "redis_snapshot_retention_limit" {
  description = "Snapshot retention (0 = disabled)"
  type        = number
  default     = 0
}

# Content — DocumentDB (MongoDB-compatible)
variable "docdb_engine_version" {
  description = "DocumentDB engine version"
  type        = string
  default     = "5.0.0"
}

variable "docdb_instance_class" {
  description = "DocumentDB instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "docdb_master_username" {
  description = "DocumentDB master username"
  type        = string
  default     = "topos_content"
}

variable "docdb_port" {
  description = "DocumentDB port"
  type        = number
  default     = 27017
}

variable "docdb_backup_retention_period" {
  description = "DocumentDB backup retention"
  type        = number
  default     = 1
}

variable "docdb_deletion_protection" {
  description = "DocumentDB deletion protection"
  type        = bool
  default     = false
}

variable "docdb_skip_final_snapshot" {
  description = "Skip final snapshot on deletion (true for Floci)"
  type        = bool
  default     = true
}

# Content — MSK (Kafka)
variable "msk_kafka_version" {
  description = "MSK Kafka version"
  type        = string
  default     = "3.7.0"
}

variable "msk_instance_type" {
  description = "MSK broker instance type"
  type        = string
  default     = "kafka.t3.small"
}

variable "msk_number_of_broker_nodes" {
  description = "Number of broker nodes (1 for Floci)"
  type        = number
  default     = 1
}

variable "msk_ebs_volume_size" {
  description = "MSK EBS volume size per broker"
  type        = number
  default     = 10
}

# Names
variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "topos-user"
}

# Tags
variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
