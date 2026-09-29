# Topos prod — Gateway dashboard.
# Apollo Router serves :4000/graphql with health/metrics on :8088; traces flow
# as service.name 'gateway' (prod compose) with 'apollo-router' kept as a
# fallback facet. Span-based until router Prometheus metrics get NR mappings.

resource "newrelic_one_dashboard_json" "gateway" {
  json = jsonencode({
    name        = "Topos ${var.environment} - Gateway"
    description = "Federation gateway throughput, latency and errors."
    permissions = var.dashboard_permissions
    pages = [
      {
        name        = "Gateway overview"
        description = "Apollo Router golden signals"
        widgets = [
          {
            title  = "Gateway requests"
            layout = { column = 1, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*) AS `requests` FROM ${local.span_source} AND service.name IN ('gateway', 'apollo-router') ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "Gateway error %"
            layout = { column = 4, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentage(count(*), WHERE error IS true) AS `error %` FROM ${local.span_source} AND service.name IN ('gateway', 'apollo-router') ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "Gateway P95 (s)"
            layout = { column = 7, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentile(duration, 95) AS `p95` FROM ${local.span_source} AND service.name IN ('gateway', 'apollo-router') ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "Gateway avg duration (s)"
            layout = { column = 10, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT average(duration) AS `avg` FROM ${local.span_source} AND service.name IN ('gateway', 'apollo-router') ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "Gateway throughput"
            layout = { column = 1, row = 4, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*) AS `requests` FROM ${local.span_source} AND service.name IN ('gateway', 'apollo-router') FACET service.name TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Gateway P95 over time"
            layout = { column = 7, row = 4, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentile(duration, 95) AS `p95` FROM ${local.span_source} AND service.name IN ('gateway', 'apollo-router') FACET service.name TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Gateway error % over time"
            layout = { column = 1, row = 7, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentage(count(*), WHERE error IS true) AS `error %` FROM ${local.span_source} AND service.name IN ('gateway', 'apollo-router') FACET service.name TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Slowest gateway operations"
            layout = { column = 7, row = 7, width = 6, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*), average(duration) AS `avg`, percentile(duration, 95) AS `p95` FROM ${local.span_source} AND service.name IN ('gateway', 'apollo-router') FACET name LIMIT 20 ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.table" }
          },
        ]
      },
    ]
  })
}
