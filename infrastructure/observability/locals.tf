locals {
  span_source   = "Span WHERE deployment.environment = '${var.environment}'"
  metric_source = "Metric WHERE deployment.environment = '${var.environment}'"
  # Log source for the collector-shipped container logs. The collector
  # normalizes log_level (TRACE/DEBUG/INFO/WARN/ERROR/FATAL) and trace.id on
  # every record, so widgets filter on those instead of per-format fields.
  log_source = "Log WHERE deployment.environment = '${var.environment}'"
  lookback   = "SINCE ${var.dashboard_lookback}"
}
