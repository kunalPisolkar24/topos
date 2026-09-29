# Topos prod observability — New Relic dashboards + alerts over OTEL data.
# Data comes from the prod otel-collector (traces/metrics/logs pipelines);
# these widgets query Span data so they work as soon as traces flow.

resource "newrelic_one_dashboard_json" "topos" {
  json = jsonencode({
    name        = "Topos ${var.environment} observability"
    description = "OTEL spans via prod otel-collector -> New Relic."
    permissions = var.dashboard_permissions
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
                  query     = "SELECT count(*) FROM ${local.span_source} FACET service.name TIMESERIES AUTO ${local.lookback}"
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
                  query     = "SELECT percentile(duration, 95) FROM ${local.span_source} FACET service.name TIMESERIES AUTO ${local.lookback}"
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
                  query     = "SELECT percentage(count(*), WHERE error IS true) AS `error %` FROM ${local.span_source} FACET service.name TIMESERIES AUTO ${local.lookback}"
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
                  query     = "SELECT count(*), average(duration), percentile(duration, 95) FROM ${local.span_source} FACET name LIMIT 20 ${local.lookback}"
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
                  query     = "SELECT count(*) AS requests FROM ${local.span_source} AND service.name IN ('gateway', 'apollo-router') ${local.lookback}"
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
                  query     = "SELECT count(*) FROM ${local.span_source} AND service.name IN ('content-service', 'content-worker', 'content-search-worker', 'content-personalizer') FACET service.name TIMESERIES AUTO ${local.lookback}"
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
                  query     = "SELECT average(duration), percentile(duration, 95) FROM ${local.span_source} AND service.name = 'ai-service' FACET name TIMESERIES AUTO ${local.lookback}"
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
                  query     = "SELECT count(*), average(duration) FROM ${local.span_source} AND service.name = 'user-service' FACET name TIMESERIES AUTO ${local.lookback}"
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
