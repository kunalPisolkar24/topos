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
    condition     = jsondecode(newrelic_one_dashboard_json.content_api.json).permissions == "PRIVATE"
    error_message = "The Content API dashboard must be private by default."
  }

  assert {
    condition     = jsondecode(newrelic_one_dashboard_json.content_workers.json).permissions == "PRIVATE"
    error_message = "The Workers dashboard must be private by default."
  }

  assert {
    condition     = jsondecode(newrelic_one_dashboard_json.ai.json).permissions == "PRIVATE"
    error_message = "The AI dashboard must be private by default."
  }

  assert {
    condition     = jsondecode(newrelic_one_dashboard_json.user.json).permissions == "PRIVATE"
    error_message = "The User dashboard must be private by default."
  }

  assert {
    condition     = jsondecode(newrelic_one_dashboard_json.gateway.json).permissions == "PRIVATE"
    error_message = "The Gateway dashboard must be private by default."
  }

  assert {
    condition     = jsondecode(newrelic_one_dashboard_json.content_api.json).name == "Topos prod - Content API"
    error_message = "The Content API dashboard must follow the Topos <env> - <service> naming."
  }

  assert {
    condition     = jsondecode(newrelic_one_dashboard_json.content_workers.json).name == "Topos prod - Workers & Kafka"
    error_message = "The Workers dashboard must follow the Topos <env> - <service> naming."
  }

  assert {
    condition     = jsondecode(newrelic_one_dashboard_json.ai.json).name == "Topos prod - AI Service"
    error_message = "The AI dashboard must follow the Topos <env> - <service> naming."
  }

  assert {
    condition     = jsondecode(newrelic_one_dashboard_json.user.json).name == "Topos prod - User Service"
    error_message = "The User dashboard must follow the Topos <env> - <service> naming."
  }

  assert {
    condition     = jsondecode(newrelic_one_dashboard_json.gateway.json).name == "Topos prod - Gateway"
    error_message = "The Gateway dashboard must follow the Topos <env> - <service> naming."
  }

  assert {
    condition     = length(jsondecode(newrelic_one_dashboard_json.content_api.json).pages[0].widgets) == 14
    error_message = "The Content API dashboard must retain its fourteen widgets."
  }

  assert {
    condition     = length(jsondecode(newrelic_one_dashboard_json.content_workers.json).pages[0].widgets) == 11
    error_message = "The Workers dashboard must retain its eleven widgets."
  }

  assert {
    condition     = length(jsondecode(newrelic_one_dashboard_json.ai.json).pages[0].widgets) == 13
    error_message = "The AI dashboard must retain its thirteen widgets."
  }

  assert {
    condition     = length(jsondecode(newrelic_one_dashboard_json.user.json).pages[0].widgets) == 14
    error_message = "The User dashboard must retain its fourteen widgets."
  }

  assert {
    condition     = length(jsondecode(newrelic_one_dashboard_json.gateway.json).pages[0].widgets) == 8
    error_message = "The Gateway dashboard must retain its eight widgets."
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
