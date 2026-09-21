variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

variable "aws_endpoint_url" {
  description = "Floci/LocalStack endpoint. Empty for real AWS."
  type        = string
  default     = "http://localhost:4566"
}

provider "aws" {
  region     = var.aws_region
  access_key = "test"
  secret_key = "test"

  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  # Floci endpoints — when aws_endpoint_url is empty, use real AWS.
  endpoints {
    apigateway     = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    cloudformation = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    ec2            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    elasticache    = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    iam            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    kms            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    rds            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    s3             = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    secretsmanager = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    ssm            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    sts            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
  }
}

# Alias for us-east-1 where required (e.g., some global services)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  access_key = "test"
  secret_key = "test"

  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    iam            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    sts            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    secretsmanager = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
    ssm            = var.aws_endpoint_url != "" ? var.aws_endpoint_url : null
  }
}
