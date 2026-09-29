# Topos prod — Content API dashboard.
# Spans (service.name = 'content-service') for RED; Prometheus metrics
# (content_* names from services/content/internal/metrics) for breakdowns.
# Metric data arrives via the prod otel-collector prometheus pipeline, which
# stamps deployment.environment through the resource processor.

resource "newrelic_one_dashboard_json" "content_api" {
  json = jsonencode({
    name        = "Topos ${var.environment} - Content API"
    description = "Content GraphQL/HTTP throughput, errors, posts, cache and AI degradation."
    permissions = var.dashboard_permissions
    pages = [
      {
        name        = "API overview"
        description = "RED signals for content-service spans plus in-flight gauge"
        widgets = [
          {
            title  = "Request throughput"
            layout = { column = 1, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT count(*) AS `requests` FROM ${local.span_source} AND service.name = 'content-service' ${local.lookback}"
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
                  query     = "SELECT percentage(count(*), WHERE error IS true) AS `error %` FROM ${local.span_source} AND service.name = 'content-service' ${local.lookback}"
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
                  query     = "SELECT percentile(duration, 95) AS `p95` FROM ${local.span_source} AND service.name = 'content-service' ${local.lookback}"
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
                  query     = "SELECT latest(content_http_requests_in_flight) AS `in flight` FROM ${local.metric_source} ${local.lookback}"
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
                  query     = "SELECT rate(sum(content_http_requests_total), 1 minute) AS `rpm` FROM ${local.metric_source} FACET route TIMESERIES AUTO ${local.lookback}"
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
                  query     = "SELECT percentile(content_http_request_duration_seconds, 95) AS `p95 s` FROM ${local.metric_source} FACET route TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "GraphQL operations/min"
            layout = { column = 1, row = 7, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(content_graphql_operations_total), 1 minute) AS `opm` FROM ${local.metric_source} FACET operation, status TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.bar" }
          },
          {
            title  = "GraphQL errors/min by kind"
            layout = { column = 5, row = 7, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(content_graphql_errors_total), 1 minute) AS `errors/min` FROM ${local.metric_source} FACET operation, kind TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.bar" }
          },
          {
            title  = "GraphQL P95 latency by operation"
            layout = { column = 9, row = 7, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentile(content_graphql_operation_duration_seconds, 95) AS `p95 s` FROM ${local.metric_source} FACET operation TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Post mutations/min"
            layout = { column = 1, row = 10, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(content_posts_created_total), 1 minute) AS `created/min` FROM ${local.metric_source} TIMESERIES AUTO ${local.lookback}"
                },
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(content_posts_updated_total), 1 minute) AS `updated/min` FROM ${local.metric_source} TIMESERIES AUTO ${local.lookback}"
                },
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(content_posts_deleted_total), 1 minute) AS `deleted/min` FROM ${local.metric_source} TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Interactions/min by kind and outcome"
            layout = { column = 5, row = 10, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(content_interactions_total), 1 minute) AS `interactions/min` FROM ${local.metric_source} FACET kind, status TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.bar" }
          },
          {
            title  = "Cache hit ratio and errors"
            layout = { column = 9, row = 10, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT sum(content_cache_hits_total) / (sum(content_cache_hits_total) + sum(content_cache_misses_total)) AS `hit ratio` FROM ${local.metric_source} TIMESERIES AUTO ${local.lookback}"
                },
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(content_cache_errors_total), 1 minute) AS `cache errors/min` FROM ${local.metric_source} TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "AI fallback and recommendation feeds"
            layout = { column = 1, row = 13, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(content_ai_fallback_engaged_total), 1 minute) AS `fallbacks/min` FROM ${local.metric_source} FACET operation TIMESERIES AUTO ${local.lookback}"
                },
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(content_recommend_feed_served_total), 1 minute) AS `feeds/min` FROM ${local.metric_source} FACET mode TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Dependency health"
            layout = { column = 7, row = 13, width = 6, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT latest(content_dependency_up) AS `up`, percentile(content_dependency_ping_duration_seconds, 95) AS `ping p95 s` FROM ${local.metric_source} FACET dep ${local.lookback}"
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
