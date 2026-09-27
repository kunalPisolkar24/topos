# Golden-signal alerts are separate from the dashboard so threshold tuning
# remains focused and the policy can be extended independently.

resource "newrelic_alert_policy" "topos" {
  name = "Topos ${var.environment} golden signals"
}

resource "newrelic_nrql_alert_condition" "error_rate" {
  account_id = var.newrelic_account_id
  policy_id  = newrelic_alert_policy.topos.id
  type       = "static"
  name       = "Topos ${var.environment} high span error rate"
  enabled    = true

  nrql {
    query = "SELECT percentage(count(*), WHERE error IS true) FROM ${local.span_source}"
  }

  warning {
    operator              = "above"
    threshold             = var.error_rate_warning_threshold
    threshold_duration    = var.alert_threshold_duration_seconds
    threshold_occurrences = "AT_LEAST_ONCE"
  }

  critical {
    operator              = "above"
    threshold             = var.error_rate_critical_threshold
    threshold_duration    = var.alert_threshold_duration_seconds
    threshold_occurrences = "AT_LEAST_ONCE"
  }

  violation_time_limit_seconds = var.alert_violation_time_limit_seconds
}

resource "newrelic_nrql_alert_condition" "p95_latency" {
  account_id = var.newrelic_account_id
  policy_id  = newrelic_alert_policy.topos.id
  type       = "static"
  name       = "Topos ${var.environment} high p95 span latency"
  enabled    = true

  nrql {
    query = "SELECT percentile(duration, 95) FROM ${local.span_source}"
  }

  warning {
    operator              = "above"
    threshold             = var.p95_latency_warning_threshold_seconds
    threshold_duration    = var.alert_threshold_duration_seconds
    threshold_occurrences = "AT_LEAST_ONCE"
  }

  critical {
    operator              = "above"
    threshold             = var.p95_latency_critical_threshold_seconds
    threshold_duration    = var.alert_threshold_duration_seconds
    threshold_occurrences = "AT_LEAST_ONCE"
  }

  violation_time_limit_seconds = var.alert_violation_time_limit_seconds
}
