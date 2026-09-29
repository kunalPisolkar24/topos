moved {
  from = aws_security_group.msk
  to   = module.security_group.aws_security_group.this
}
