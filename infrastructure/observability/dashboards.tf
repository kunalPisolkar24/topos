# Topos prod observability — New Relic dashboards + alerts over OTEL data.
# Data comes from the prod otel-collector (traces/metrics/logs pipelines);
# these widgets query Span data so they work as soon as traces flow.

resource "newrelic_one_dashboard_json" "topos" {
  json = jsonencode({
    name        = "Topos ${var.environment} observability"
    description = "OTEL spans via prod otel-collector -> New Relic."
    permissions = "PUBLIC_READ_WRITE"
    pages = [
      {
        name        = "Overview"
        description = "Throughput, latency, errors by service.name"
        widgets = [
          {
            title  = "Throughput by service"
            layout = { column = 1, row = 1, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*) FROM Span FACET service.name TIMESERIES AUTO SINCE 1 hour ago"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "P95 duration by service"
            layout = { column = 5, row = 1, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentile(duration, 95) FROM Span FACET service.name TIMESERIES AUTO SINCE 1 hour ago"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Error % by service"
            layout = { column = 9, row = 1, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentage(count(*), WHERE error IS true) AS `error %` FROM Span FACET service.name TIMESERIES AUTO SINCE 1 hour ago"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Slowest operations"
            layout = { column = 1, row = 4, width = 6, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*), average(duration), percentile(duration, 95) FROM Span FACET name LIMIT 20 SINCE 1 hour ago"
                }
              ]
            }
            visualization = { id = "viz.table" }
          },
          {
            title  = "Gateway throughput"
            layout = { column = 7, row = 4, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*) AS requests FROM Span WHERE service.name IN ('gateway', 'apollo-router') SINCE 1 hour ago"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "Worker spans (content-worker family)"
            layout = { column = 10, row = 4, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*) FROM Span WHERE service.name IN ('content-service', 'content-worker', 'content-search-worker', 'content-personalizer') FACET service.name TIMESERIES AUTO SINCE 1 hour ago"
                }
              ]
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "AI gRPC duration"
            layout = { column = 1, row = 7, width = 6, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT average(duration), percentile(duration, 95) FROM Span WHERE service.name = 'ai-service' FACET name TIMESERIES AUTO SINCE 1 hour ago"
                }
              ]
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "User DB/Redis spans"
            layout = { column = 7, row = 7, width = 6, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*), average(duration) FROM Span WHERE service.name = 'user-service' FACET name TIMESERIES AUTO SINCE 1 hour ago"
                }
              ]
            }
            visualization = { id = "viz.line" }
          },
        ]
      },
    ]
  })
}

resource "newrelic_alert_policy" "topos" {
  name = "Topos ${var.environment} golden signals"
}

resource "newrelic_nrql_alert_condition" "error_rate" {
  account_id = var.newrelic_account_id
  policy_id  = newrelic_alert_policy.topos.id
  type       = "static"
  name       = "Topos high span error rate"
  enabled    = true

  nrql {
    query = "SELECT percentage(count(*), WHERE error IS true) FROM Span"
  }

  critical {
    operator              = "above"
    threshold             = 5
    threshold_duration    = 300
    threshold_occurrences = "AT_LEAST_ONCE"
  }

  violation_time_limit_seconds = 86400
}

resource "newrelic_nrql_alert_condition" "p95_latency" {
  account_id = var.newrelic_account_id
  policy_id  = newrelic_alert_policy.topos.id
  type       = "static"
  name       = "Topos high p95 span latency"
  enabled    = true

  nrql {
    query = "SELECT percentile(duration, 95) FROM Span"
  }

  critical {
    operator              = "above"
    threshold             = 2
    threshold_duration    = 300
    threshold_occurrences = "AT_LEAST_ONCE"
  }

  violation_time_limit_seconds = 86400
}
