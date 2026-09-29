# Floci/LocalStack endpoint is configured via var.aws_endpoint_url (see
# variables.tf). When empty, the default AWS endpoints are used.
provider "aws" {
  region = var.aws_region

  # Real AWS relies on the standard provider credential chain (environment,
  # profile, workload identity, etc.). Floci only needs placeholder values.
  access_key = var.aws_endpoint_url != "" ? "test" : null
  secret_key = var.aws_endpoint_url != "" ? "test" : null

  skip_credentials_validation = var.aws_endpoint_url != ""
  skip_metadata_api_check     = var.aws_endpoint_url != ""
  skip_requesting_account_id  = var.aws_endpoint_url != ""
  s3_use_path_style           = var.aws_endpoint_url != ""

  # Floci endpoints — when aws_endpoint_url is empty, use real AWS.
  endpoints {
    apigateway     = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    cloudformation = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    docdb          = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    ec2            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    elasticache    = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    iam            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    kafka          = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    kms            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    rds            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    s3             = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    secretsmanager = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    ssm            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    sts            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
  }
}
