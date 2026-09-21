terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Local backend for Floci. For real AWS, use S3 backend via backend.hcl:
  #   terraform init -backend-config=backend.hcl
  # See backend.hcl.example for the S3 configuration.
}
