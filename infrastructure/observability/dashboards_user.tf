# Topos prod — User Service dashboard.
# HTTP/GraphQL serving, auth funnels, Postgres pool, cache and dependencies
# from services/user/src/observability/metrics.ts.
# NOTE: dependency_up and dependency_ping_duration_seconds are also exported
# by ai-service under the same names; those widgets scope by scrape target
# (instance LIKE '%user-service%'). Drop the clause if your NR attribute differs
# (check the metric in Metrics explorer).

resource "newrelic_one_dashboard_json" "user" {
  json = jsonencode({
    name        = "Topos ${var.environment} - User Service"
    description = "Auth funnel, HTTP/GraphQL serving, Postgres pool, cache and dependencies."
    permissions = var.dashboard_permissions
    pages = [
      {
        name        = "User overview"
        description = "RED signals for user-service plus in-flight gauge"
        widgets = [
          {
            title  = "HTTP requests/min"
            layout = { column = 1, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(http_requests_total), 1 minute) AS `req/min` FROM ${local.metric_source} AND instance LIKE '%user-service%' ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "Span error %"
            layout = { column = 4, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentage(count(*), WHERE error IS true) AS `error %` FROM ${local.span_source} AND service.name = 'user-service' ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "P95 span duration (s)"
            layout = { column = 7, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentile(duration, 95) AS `p95` FROM ${local.span_source} AND service.name = 'user-service' ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "HTTP requests in flight"
            layout = { column = 10, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT latest(http_requests_in_flight) AS `in flight` FROM ${local.metric_source} AND instance LIKE '%user-service%' ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "HTTP requests/min by route"
            layout = { column = 1, row = 4, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(http_requests_total), 1 minute) AS `rpm` FROM ${local.metric_source} AND instance LIKE '%user-service%' FACET route, status TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.bar" }
          },
          {
            title  = "HTTP P95 latency by route"
            layout = { column = 7, row = 4, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentile(http_request_duration_seconds, 95) AS `p95 s` FROM ${local.metric_source} AND instance LIKE '%user-service%' FACET route TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "GraphQL operations and errors"
            layout = { column = 1, row = 7, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(graphql_operations_total), 1 minute) AS `opm` FROM ${local.metric_source} AND instance LIKE '%user-service%' FACET operation, status TIMESERIES AUTO ${local.lookback}"
                },
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(graphql_errors_total), 1 minute) AS `errors/min` FROM ${local.metric_source} AND instance LIKE '%user-service%' FACET operation, code TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.bar" }
          },
          {
            title  = "Signups, signins and failures"
            layout = { column = 5, row = 7, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(user_signups_total), 1 minute) AS `signups/min` FROM ${local.metric_source} TIMESERIES AUTO ${local.lookback}"
                },
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(user_signins_total), 1 minute) AS `signins/min` FROM ${local.metric_source} TIMESERIES AUTO ${local.lookback}"
                },
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(user_signin_failures_total), 1 minute) AS `failures/min` FROM ${local.metric_source} TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Signin failure %"
            layout = { column = 9, row = 7, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT sum(user_signin_failures_total) / (sum(user_signins_total) + sum(user_signin_failures_total)) * 100 AS `failure %` FROM ${local.metric_source} TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Postgres pool connections by state"
            layout = { column = 1, row = 10, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT latest(db_pool_connections) AS `conns` FROM ${local.metric_source} FACET node, state TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "DB query P95 by operation"
            layout = { column = 5, row = 10, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentile(db_query_duration_seconds, 95) AS `p95 s` FROM ${local.metric_source} AND instance LIKE '%user-service%' FACET operation TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Cache hit ratio and invalidations"
            layout = { column = 9, row = 10, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT filter(sum(cache_operations_total), WHERE result = 'hit') / filter(sum(cache_operations_total), WHERE result IN ('hit', 'miss')) AS `hit ratio` FROM ${local.metric_source} AND instance LIKE '%user-service%' TIMESERIES AUTO ${local.lookback}"
                },
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(cache_invalidations_total), 1 minute) AS `invalidations/min` FROM ${local.metric_source} AND instance LIKE '%user-service%' FACET operation TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Dependency health (user-service target)"
            layout = { column = 1, row = 13, width = 6, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT latest(dependency_up) AS `up`, percentile(dependency_ping_duration_seconds, 95) AS `ping p95 s` FROM ${local.metric_source} AND instance LIKE '%user-service%' FACET dep ${local.lookback}"
                },
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT latest(redis_connected) AS `redis connected` FROM ${local.metric_source} AND instance LIKE '%user-service%' ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.table" }
          },
          {
            title  = "Slowest user operations"
            layout = { column = 7, row = 13, width = 6, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*), average(duration) AS `avg`, percentile(duration, 95) AS `p95` FROM ${local.span_source} AND service.name = 'user-service' FACET name LIMIT 20 ${local.lookback}"
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
