# Fast contract tests use mocked AWS resources. They verify composition and
# environment-dependent configuration without requiring Docker or Floci.

mock_provider "aws" {}
mock_provider "random" {}

run "floci_service_contracts" {
  command = plan

  variables {
    environment      = "floci"
    aws_endpoint_url = "http://localhost:4566"
  }

  assert {
    condition     = aws_ssm_parameter.user_config.name == "/topos/user/config"
    error_message = "User config must retain its stable SSM path."
  }

  assert {
    condition     = aws_ssm_parameter.ai_config.name == "/topos/ai/config"
    error_message = "AI config must retain its stable SSM path."
  }

  assert {
    condition     = aws_ssm_parameter.content_config.name == "/topos/content/config"
    error_message = "Content config must retain its stable SSM path."
  }

  assert {
    condition     = aws_secretsmanager_secret.user_secrets.name == "topos/user/secrets"
    error_message = "User secret name is an application integration contract."
  }

  assert {
    condition     = aws_secretsmanager_secret.ai_secrets.name == "topos/ai/secrets"
    error_message = "AI secret name is an application integration contract."
  }

  assert {
    condition     = aws_secretsmanager_secret.content_secrets.name == "topos/content/secrets"
    error_message = "Content secret name is an application integration contract."
  }

}

run "real_aws_service_contracts" {
  command = plan

  variables {
    environment      = "prod"
    aws_endpoint_url = ""
  }

  assert {
    condition     = aws_secretsmanager_secret.user_secrets.tags.Service == "user"
    error_message = "User resources must retain their service tag."
  }

  assert {
    condition     = aws_secretsmanager_secret.content_secrets.tags.Service == "content"
    error_message = "Content resources must retain their service tag."
  }
}

run "required_tags_cannot_be_overridden" {
  command = plan

  variables {
    tags = {
      Project = "incorrect"
      Service = "incorrect"
    }
  }

  assert {
    condition     = aws_secretsmanager_secret.user_secrets.tags.Project == var.project
    error_message = "Caller-provided tags must not override the project contract."
  }

  assert {
    condition     = aws_secretsmanager_secret.content_secrets.tags.Service == "content"
    error_message = "Caller-provided tags must not override the service contract."
  }
}
