output "primary_endpoint" {
  value = try(aws_elasticache_replication_group.user.primary_endpoint_address, "")
}

output "reader_endpoint" {
  value = try(aws_elasticache_replication_group.user.reader_endpoint_address, "")
}

output "redis_url" {
  description = "rediss:// with auth token, for app REDIS_URL"
  value       = "rediss://:${random_password.auth.result}@${coalesce(try(aws_elasticache_replication_group.user.primary_endpoint_address, null), try(aws_elasticache_replication_group.user.configuration_endpoint_address, null), "user-cache")}:6379"
  sensitive   = true
}

output "auth_token_secret_arn" {
  value = aws_secretsmanager_secret.auth_token.arn
}

output "auth_token" {
  value     = random_password.auth.result
  sensitive = true
}

output "security_group_id" {
  value = aws_security_group.cache.id
}
