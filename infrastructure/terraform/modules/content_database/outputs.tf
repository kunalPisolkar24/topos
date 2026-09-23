output "cluster_id" {
  value = try(aws_docdb_cluster.content.id, "")
}

output "cluster_endpoint" {
  value = try(aws_docdb_cluster.content.endpoint, "")
}

output "reader_endpoint" {
  value = try(aws_docdb_cluster.content.reader_endpoint, "")
}

output "port" {
  value = var.port
}

output "master_secret_arn" {
  value = aws_secretsmanager_secret.master.arn
}

output "master_username" {
  value = var.master_username
}

output "master_password" {
  value     = random_password.master.result
  sensitive = true
}

output "security_group_id" {
  value = aws_security_group.docdb.id
}

output "subnet_group_name" {
  value = aws_docdb_subnet_group.content.name
}
