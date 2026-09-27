# Dashboard and alert configuration contracts run against a mocked provider.
# Live New Relic verification remains a separate, credential-gated command.

mock_provider "newrelic" {}

run "production_dashboard_and_alerts" {
  command = plan

  variables {
    newrelic_account_id = 1
    newrelic_api_key    = "test-api-key"
    environment         = "prod"
  }

  assert {
    condition     = jsondecode(newrelic_one_dashboard_json.topos.json).permissions == "PRIVATE"
    error_message = "Dashboards must be private by default."
  }

  assert {
    condition     = length(jsondecode(newrelic_one_dashboard_json.topos.json).pages[0].widgets) == 8
    error_message = "The overview dashboard must retain its eight golden-signal widgets."
  }

  assert {
    condition     = newrelic_nrql_alert_condition.error_rate.critical[0].threshold == var.error_rate_critical_threshold
    error_message = "The error-rate alert must use the configurable critical threshold."
  }

  assert {
    condition     = newrelic_nrql_alert_condition.p95_latency.critical[0].threshold == var.p95_latency_critical_threshold_seconds
    error_message = "The latency alert must use the configurable critical threshold."
  }

  assert {
    condition     = strcontains(newrelic_nrql_alert_condition.error_rate.nrql[0].query, "deployment.environment = 'prod'")
    error_message = "Alert NRQL must be scoped to its deployment environment."
  }
}
