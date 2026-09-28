variable "newrelic_account_id" {
  description = "Numeric New Relic account ID (from ?account= in the UI)"
  type        = number
}

variable "newrelic_api_key" {
  description = "User API key. The Make targets map NEW_RELIC_API_KEY to this sensitive input."
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

variable "dashboard_permissions" {
  description = "New Relic dashboard visibility. Use a public setting only when needed."
  type        = string
  default     = "PRIVATE"

  validation {
    condition     = contains(["PRIVATE", "PUBLIC_READ_ONLY", "PUBLIC_READ_WRITE"], var.dashboard_permissions)
    error_message = "dashboard_permissions must be PRIVATE, PUBLIC_READ_ONLY, or PUBLIC_READ_WRITE."
  }
}

variable "dashboard_lookback" {
  description = "NRQL lookback used by dashboard widgets."
  type        = string
  default     = "1 hour ago"
}

variable "alert_threshold_duration_seconds" {
  description = "How long a threshold must be breached before an alert opens."
  type        = number
  default     = 300

  validation {
    condition     = var.alert_threshold_duration_seconds >= 60
    error_message = "alert_threshold_duration_seconds must be at least 60 seconds."
  }
}

variable "alert_violation_time_limit_seconds" {
  description = "Maximum duration for an open alert violation."
  type        = number
  default     = 86400
}

variable "error_rate_warning_threshold" {
  description = "Warning span-error percentage."
  type        = number
  default     = 2
}

variable "error_rate_critical_threshold" {
  description = "Critical span-error percentage."
  type        = number
  default     = 5
}

variable "p95_latency_warning_threshold_seconds" {
  description = "Warning p95 span duration in seconds."
  type        = number
  default     = 1
}

variable "p95_latency_critical_threshold_seconds" {
  description = "Critical p95 span duration in seconds."
  type        = number
  default     = 2
}

variable "log_error_warning_threshold" {
  description = "Warning count of ERROR/FATAL log lines per evaluation window."
  type        = number
  default     = 10
}

variable "log_error_critical_threshold" {
  description = "Critical count of ERROR/FATAL log lines per evaluation window."
  type        = number
  default     = 50
}

variable "log_silence_alert_enabled" {
  description = "Enable the log-pipeline silence alert. Keep false until logs are confirmed flowing, then enable and tune."
  type        = bool
  default     = false
}

variable "log_silence_threshold_duration_seconds" {
  description = "How long with (near-)zero log volume before the silence alert opens."
  type        = number
  default     = 600

  validation {
    condition     = var.log_silence_threshold_duration_seconds >= 120
    error_message = "log_silence_threshold_duration_seconds must be at least 120 seconds."
  }
}
