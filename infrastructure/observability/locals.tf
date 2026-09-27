locals {
  span_source = "Span WHERE deployment.environment = '${var.environment}'"
  lookback    = "SINCE ${var.dashboard_lookback}"
}
