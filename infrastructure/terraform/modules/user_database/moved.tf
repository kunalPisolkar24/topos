# Removing unconditional count = 1 from these resources improves their module
# interface. Preserve the existing state addresses so this refactor never
# replaces the RDS Proxy or its IAM role.

moved {
  from = aws_iam_role.proxy[0]
  to   = aws_iam_role.proxy
}

moved {
  from = aws_iam_role_policy.proxy_secrets[0]
  to   = aws_iam_role_policy.proxy_secrets
}

moved {
  from = aws_db_proxy.user[0]
  to   = aws_db_proxy.user
}

moved {
  from = aws_db_proxy_default_target_group.user[0]
  to   = aws_db_proxy_default_target_group.user
}

moved {
  from = aws_db_proxy_target.user[0]
  to   = aws_db_proxy_target.user
}

moved {
  from = aws_security_group.db
  to   = module.security_group.aws_security_group.this
}
