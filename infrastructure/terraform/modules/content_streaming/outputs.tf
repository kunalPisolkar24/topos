output "cluster_arn" {
  value = try(aws_msk_cluster.content.arn, "")
}

output "cluster_name" {
  value = try(aws_msk_cluster.content.cluster_name, "")
}

output "bootstrap_brokers" {
  description = "Plaintext bootstrap brokers (Floci)"
  value       = try(aws_msk_cluster.content.bootstrap_brokers, "")
  sensitive   = true
}

output "bootstrap_brokers_tls" {
  value     = try(aws_msk_cluster.content.bootstrap_brokers_tls, "")
  sensitive = true
}

output "security_group_id" {
  value = module.security_group.id
}
