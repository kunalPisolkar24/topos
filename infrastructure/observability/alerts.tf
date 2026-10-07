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

# Log alerts ride the same policy. Thresholds count ERROR/FATAL lines per
# evaluation window; the silence alert is off until logs are confirmed
# flowing in production (see log_silence_alert_enabled).
resource "newrelic_nrql_alert_condition" "log_errors" {
  account_id = var.newrelic_account_id
  policy_id  = newrelic_alert_policy.topos.id
  type       = "static"
  name       = "Topos ${var.environment} high error log volume"
  enabled    = true

  nrql {
    query = "SELECT count(*) FROM ${local.log_source} WHERE log_level IN ('ERROR', 'FATAL') FACET service.name"
  }

  warning {
    operator              = "above"
    threshold             = var.log_error_warning_threshold
    threshold_duration    = var.alert_threshold_duration_seconds
    threshold_occurrences = "AT_LEAST_ONCE"
  }

  critical {
    operator              = "above"
    threshold             = var.log_error_critical_threshold
    threshold_duration    = var.alert_threshold_duration_seconds
    threshold_occurrences = "AT_LEAST_ONCE"
  }

  violation_time_limit_seconds = var.alert_violation_time_limit_seconds
}

resource "newrelic_nrql_alert_condition" "log_silence" {
  account_id = var.newrelic_account_id
  policy_id  = newrelic_alert_policy.topos.id
  type       = "static"
  name       = "Topos ${var.environment} log pipeline silence"
  enabled    = var.log_silence_alert_enabled

  nrql {
    query = "SELECT count(*) FROM ${local.log_source}"
  }

  critical {
    operator              = "below"
    threshold             = 1
    threshold_duration    = var.log_silence_threshold_duration_seconds
    threshold_occurrences = "AT_LEAST_ONCE"
  }

  violation_time_limit_seconds = var.alert_violation_time_limit_seconds
}

# Agentic-writing alerts: best-effort fallback share (the verify loop could
# not fix the model output) and LLM provider error share. Both ride the
# same golden-signals policy.

resource "newrelic_nrql_alert_condition" "post_best_effort" {
  account_id = var.newrelic_account_id
  policy_id  = newrelic_alert_policy.topos.id
  type       = "static"
  name       = "Topos ${var.environment} high best-effort generation share"
  enabled    = true

  nrql {
    query = "SELECT filter(sum(post_generation_verifications_total), WHERE outcome = 'best-effort') / sum(post_generation_verifications_total) * 100 AS `best-effort %` FROM ${local.metric_source}"
  }

  warning {
    operator              = "above"
    threshold             = var.post_best_effort_warning_percent
    threshold_duration    = var.alert_threshold_duration_seconds
    threshold_occurrences = "AT_LEAST_ONCE"
  }

  critical {
    operator              = "above"
    threshold             = var.post_best_effort_critical_percent
    threshold_duration    = var.alert_threshold_duration_seconds
    threshold_occurrences = "AT_LEAST_ONCE"
  }

  violation_time_limit_seconds = var.alert_violation_time_limit_seconds
}

resource "newrelic_nrql_alert_condition" "llm_error_share" {
  account_id = var.newrelic_account_id
  policy_id  = newrelic_alert_policy.topos.id
  type       = "static"
  name       = "Topos ${var.environment} high LLM error share"
  enabled    = true

  nrql {
    query = "SELECT filter(sum(llm_requests_total), WHERE status = 'error') / sum(llm_requests_total) * 100 AS `llm error %` FROM ${local.metric_source}"
  }

  warning {
    operator              = "above"
    threshold             = var.llm_error_warning_percent
    threshold_duration    = var.alert_threshold_duration_seconds
    threshold_occurrences = "AT_LEAST_ONCE"
  }

  critical {
    operator              = "above"
    threshold             = var.llm_error_critical_percent
    threshold_duration    = var.alert_threshold_duration_seconds
    threshold_occurrences = "AT_LEAST_ONCE"
  }

  violation_time_limit_seconds = var.alert_violation_time_limit_seconds
}
