output "db_subnet_group" {
  value = aws_db_subnet_group.user.name
}

output "writer_endpoint" {
  value = try(aws_db_instance.user.address, "")
}

output "reader_endpoint" {
  value = try(aws_db_instance.user.address, "")
}

output "proxy_endpoint" {
  value = try(aws_db_proxy.user[0].endpoint, "")
}

output "master_secret_arn" {
  value = aws_secretsmanager_secret.master.arn
}

output "master_password" {
  value     = random_password.master.result
  sensitive = true
}

output "security_group_id" {
  value = aws_security_group.db.id
}
