variable "newrelic_account_id" {
  description = "Numeric New Relic account ID (from ?account= in the UI)"
  type        = number
}

variable "newrelic_api_key" {
  description = "User API key (NRAK-...). Never commit; pass via NEW_RELIC_API_KEY env."
  type        = string
  sensitive   = true
}

variable "newrelic_region" {
  description = "New Relic region: US or EU"
  type        = string
  default     = "US"

  validation {
    condition     = contains(["US", "EU"], var.newrelic_region)
    error_message = "newrelic_region must be US or EU."
  }
}

variable "environment" {
  description = "Deployment environment label stamped on dashboards"
  type        = string
  default     = "prod"
}
