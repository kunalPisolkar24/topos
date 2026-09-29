# Topos prod — Logs dashboard.
# Container logs shipped by the prod otel-collector filelog receiver, already
# normalized (log_level, trace.id, service.name). Triage flow: error spike or
# table row -> trace_id -> exact trace. Empty panels mean the pipeline (not
# necessarily the apps) needs attention — see the silence alert in alerts.tf.

resource "newrelic_one_dashboard_json" "logs" {
  json = jsonencode({
    name        = "Topos ${var.environment} - Logs"
    description = "Container log volume, errors and recent error lines with trace links."
    permissions = var.dashboard_permissions
    pages = [
      {
        name        = "Logs overview"
        description = "Volume, errors and recent error lines by service.name"
        widgets = [
          {
            title  = "Log volume by service"
            layout = { column = 1, row = 1, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*) FROM ${local.log_source} FACET service.name TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Errors by service"
            layout = { column = 5, row = 1, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*) FROM ${local.log_source} WHERE log_level IN ('ERROR', 'FATAL') FACET service.name TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Error lines"
            layout = { column = 9, row = 1, width = 4, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*) AS errors FROM ${local.log_source} WHERE log_level IN ('ERROR', 'FATAL') ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "Recent errors"
            layout = { column = 1, row = 4, width = 6, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT message, service.name, trace_id, timestamp FROM ${local.log_source} WHERE log_level IN ('ERROR', 'FATAL') LIMIT 50 ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.table" }
          },
          {
            title  = "Warnings trend"
            layout = { column = 7, row = 4, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*) FROM ${local.log_source} WHERE log_level = 'WARN' FACET service.name TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
        ]
      },
    ]
  })
}
