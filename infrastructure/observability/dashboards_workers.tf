# Topos prod — Workers & Kafka dashboard.
# Covers content-worker, content-search-worker and content-personalizer, which
# share the content_worker_* collectors (services/content/internal/metrics).
# High-level billboards first, then per-outcome throughput, lag/retries and
# per-worker span signals.

resource "newrelic_one_dashboard_json" "content_workers" {
  json = jsonencode({
    name        = "Topos ${var.environment} - Workers & Kafka"
    description = "Kafka consumer throughput, lag, retries, DLQ and per-worker spans."
    permissions = var.dashboard_permissions
    pages = [
      {
        name        = "Workers overview"
        description = "Consumer health for the content-worker family"
        widgets = [
          {
            title  = "Messages processed"
            layout = { column = 1, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(content_worker_messages_total), 1 minute) AS `msg/min` FROM ${local.metric_source} ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "Failed + DLQ %"
            layout = { column = 4, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT filter(sum(content_worker_messages_total), WHERE result IN ('failed', 'dlq')) / sum(content_worker_messages_total) * 100 AS `bad %` FROM ${local.metric_source} ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "DLQ messages/min"
            layout = { column = 7, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(content_worker_messages_total), 1 minute) AS `dlq/min` FROM ${local.metric_source} AND result = 'dlq' ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "Max consumer lag (msgs)"
            layout = { column = 10, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT max(content_worker_consumer_lag) AS `lag` FROM ${local.metric_source} ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "Messages/min by outcome"
            layout = { column = 1, row = 4, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(content_worker_messages_total), 1 minute) AS `msg/min` FROM ${local.metric_source} FACET result TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.bar" }
          },
          {
            title  = "Consumer lag by reader"
            layout = { column = 7, row = 4, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT latest(content_worker_consumer_lag) AS `lag` FROM ${local.metric_source} FACET reader TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Retries/min"
            layout = { column = 1, row = 7, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(content_worker_retries_total), 1 minute) AS `retries/min` FROM ${local.metric_source} TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Worker span throughput"
            layout = { column = 5, row = 7, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*) AS `spans` FROM ${local.span_source} AND service.name IN ('content-worker', 'content-search-worker', 'content-personalizer') FACET service.name TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Worker span P95 by service"
            layout = { column = 9, row = 7, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentile(duration, 95) AS `p95` FROM ${local.span_source} AND service.name IN ('content-worker', 'content-search-worker', 'content-personalizer') FACET service.name TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Worker span error % by service"
            layout = { column = 1, row = 10, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentage(count(*), WHERE error IS true) AS `error %` FROM ${local.span_source} AND service.name IN ('content-worker', 'content-search-worker', 'content-personalizer') FACET service.name TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Slowest worker operations"
            layout = { column = 7, row = 10, width = 6, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*), average(duration) AS `avg`, percentile(duration, 95) AS `p95` FROM ${local.span_source} AND service.name IN ('content-worker', 'content-search-worker', 'content-personalizer') FACET service.name, name LIMIT 20 ${local.lookback}"
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
