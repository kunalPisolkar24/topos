output "user_vpc_id" {
  description = "VPC ID"
  value       = var.vpc_id
}

output "user_db_subnet_group" {
  description = "DB subnet group name"
  value       = module.user_database.db_subnet_group
}

output "user_db_writer_endpoint" {
  description = "RDS writer endpoint (for migrator: DATABASE_URL_MIGRATE)"
  value       = module.user_database.writer_endpoint
  sensitive   = true
}

output "user_db_reader_endpoint" {
  description = "RDS reader endpoint"
  value       = module.user_database.reader_endpoint
  sensitive   = true
}

output "user_db_proxy_endpoint" {
  description = "RDS Proxy endpoint (for app: DATABASE_URL)"
  value       = module.user_database.proxy_endpoint
  sensitive   = true
}

output "user_db_name" {
  value = var.postgres_db_name
}

output "user_db_master_secret_arn" {
  description = "ARN of the RDS master secret"
  value       = module.user_database.master_secret_arn
  sensitive   = true
}

output "user_redis_endpoint" {
  description = "ElastiCache primary endpoint"
  value       = module.user_cache.primary_endpoint
  sensitive   = true
}

output "user_redis_reader_endpoint" {
  value     = module.user_cache.reader_endpoint
  sensitive = true
}

output "user_redis_url" {
  description = "Redis URL (rediss:// with token when TLS+auth)"
  value       = module.user_cache.redis_url
  sensitive   = true
}

output "user_redis_auth_token_secret_arn" {
  value     = module.user_cache.auth_token_secret_arn
  sensitive = true
}

output "user_config_param_name" {
  value = aws_ssm_parameter.user_config.name
}

output "user_secrets_name" {
  value = aws_secretsmanager_secret.user_secrets.name
}

output "ai_db_name" {
  description = "AI checkpoint database on the shared instance"
  value       = module.user_database.ai_db_name
}

output "ai_db_username" {
  description = "AI checkpoint database username"
  value       = module.user_database.ai_username
}

output "ai_db_secret_arn" {
  description = "ARN of the AI checkpointer secret (TF-managed, do not overwrite without --force)"
  value       = module.user_database.ai_secret_arn
  sensitive   = true
}

output "ai_config_param_name" {
  value = aws_ssm_parameter.ai_config.name
}

output "ai_secrets_name" {
  value = aws_secretsmanager_secret.ai_secrets.name
}

output "content_docdb_cluster_endpoint" {
  description = "DocumentDB cluster endpoint"
  value       = module.content_database.cluster_endpoint
  sensitive   = true
}

output "content_docdb_reader_endpoint" {
  value     = module.content_database.reader_endpoint
  sensitive = true
}

output "content_docdb_master_secret_arn" {
  value     = module.content_database.master_secret_arn
  sensitive = true
}

output "content_msk_bootstrap_brokers" {
  description = "MSK bootstrap brokers (plaintext)"
  value       = module.content_streaming.bootstrap_brokers
  sensitive   = true
}

output "content_msk_cluster_arn" {
  value = module.content_streaming.cluster_arn
}

output "content_config_param_name" {
  value = aws_ssm_parameter.content_config.name
}

output "content_secrets_name" {
  value = aws_secretsmanager_secret.content_secrets.name
}
