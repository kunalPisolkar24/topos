# Topos prod — AI Service dashboard.
# gRPC server, LLM/embedding providers, Qdrant vector store, retrieval and
# feed-agent metrics from services/ai/src/observability/metrics.py.
# NOTE: dependency_up and dependency_ping_duration_seconds are also exported
# by user-service under the same names; those widgets scope by scrape target
# (instance LIKE '%ai-service%'). Drop the clause if your NR attribute differs
# (check the metric in Metrics explorer).

resource "newrelic_one_dashboard_json" "ai" {
  json = jsonencode({
    name        = "Topos ${var.environment} - AI Service"
    description = "gRPC serving, LLM/embeddings, Qdrant, retrieval and recommendations."
    permissions = var.dashboard_permissions
    pages = [
      {
        name        = "AI overview"
        description = "Serving RED plus provider and vector-store health"
        widgets = [
          {
            title  = "gRPC requests/min"
            layout = { column = 1, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(grpc_requests_total), 1 minute) AS `req/min` FROM ${local.metric_source} ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "gRPC error %"
            layout = { column = 4, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT filter(sum(grpc_requests_total), WHERE status = 'error') / sum(grpc_requests_total) * 100 AS `error %` FROM ${local.metric_source} ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "gRPC P95 (s)"
            layout = { column = 7, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentile(grpc_request_duration_seconds, 95) AS `p95` FROM ${local.metric_source} ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "Active gRPC requests"
            layout = { column = 10, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT latest(grpc_active_requests) AS `active` FROM ${local.metric_source} ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "gRPC requests/min by method and status"
            layout = { column = 1, row = 4, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(grpc_requests_total), 1 minute) AS `req/min` FROM ${local.metric_source} FACET method, status TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.bar" }
          },
          {
            title  = "gRPC P95 by method"
            layout = { column = 7, row = 4, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentile(grpc_request_duration_seconds, 95) AS `p95 s` FROM ${local.metric_source} FACET method TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "LLM calls/min by model and status"
            layout = { column = 1, row = 7, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(llm_requests_total), 1 minute) AS `calls/min` FROM ${local.metric_source} FACET model, status TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.bar" }
          },
          {
            title  = "LLM tokens/min and retries"
            layout = { column = 5, row = 7, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(llm_tokens_total), 1 minute) AS `tokens/min` FROM ${local.metric_source} FACET token_type TIMESERIES AUTO ${local.lookback}"
                },
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(llm_retries_total), 1 minute) AS `retries/min` FROM ${local.metric_source} TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Embeddings and Qdrant ops/min"
            layout = { column = 9, row = 7, width = 4, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(embedding_requests_total), 1 minute) AS `emb/min` FROM ${local.metric_source} FACET mode, status TIMESERIES AUTO ${local.lookback}"
                },
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(qdrant_requests_total), 1 minute) AS `qdrant/min` FROM ${local.metric_source} FACET operation, status TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.bar" }
          },
          {
            title  = "Provider and store P95"
            layout = { column = 1, row = 10, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentile(llm_request_duration_seconds, 95) AS `llm p95 s` FROM ${local.metric_source} FACET model TIMESERIES AUTO ${local.lookback}"
                },
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentile(qdrant_request_duration_seconds, 95) AS `qdrant p95 s` FROM ${local.metric_source} FACET operation TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Retrieval errors and judge verdicts"
            layout = { column = 7, row = 10, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(retrieval_fetch_errors_total), 1 minute) AS `fetch errors/min` FROM ${local.metric_source} FACET source TIMESERIES AUTO ${local.lookback}"
                },
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(chat_judge_verdicts_total), 1 minute) AS `verdicts/min` FROM ${local.metric_source} FACET verdict TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.bar" }
          },
          {
            title  = "Feed decisions, workflows and cold starts"
            layout = { column = 1, row = 13, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(feed_agent_decisions_total), 1 minute) AS `decisions/min` FROM ${local.metric_source} FACET outcome TIMESERIES AUTO ${local.lookback}"
                },
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(post_workflow_transitions_total), 1 minute) AS `transitions/min` FROM ${local.metric_source} FACET transition TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.line" }
          },
          {
            title  = "Dependency health (ai-service target)"
            layout = { column = 7, row = 13, width = 6, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT latest(dependency_up) AS `up`, percentile(dependency_ping_duration_seconds, 95) AS `ping p95 s` FROM ${local.metric_source} AND instance LIKE '%ai-service%' FACET dep ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.table" }
          },
        ]
      },
      {
        name        = "Post generation verification"
        description = "Agentic verify-and-repair loop: outcomes, issues and latency"
        widgets = [
          {
            title  = "First-pass %"
            layout = { column = 1, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT filter(sum(post_generation_verifications_total), WHERE outcome = 'first-pass') / sum(post_generation_verifications_total) * 100 AS `first-pass %` FROM ${local.metric_source} ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "Best-effort %"
            layout = { column = 4, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT filter(sum(post_generation_verifications_total), WHERE outcome = 'best-effort') / sum(post_generation_verifications_total) * 100 AS `best-effort %` FROM ${local.metric_source} ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "Generation P95 (s)"
            layout = { column = 7, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT percentile(post_generation_duration_seconds, 95) AS `p95 s` FROM ${local.metric_source} FACET outcome ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "LLM error %"
            layout = { column = 10, row = 1, width = 3, height = 3 }
            rawConfiguration = {
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT filter(sum(llm_requests_total), WHERE status = 'error') / sum(llm_requests_total) * 100 AS `llm error %` FROM ${local.metric_source} ${local.lookback}"
                }
              ]
            }
            visualization = { id = "viz.billboard" }
          },
          {
            title  = "Verification outcomes/min by tone and length"
            layout = { column = 1, row = 4, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(post_generation_verifications_total), 1 minute) AS `outcomes/min` FROM ${local.metric_source} FACET outcome, tone, length TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.bar" }
          },
          {
            title  = "Verification issues/min by rule"
            layout = { column = 7, row = 4, width = 6, height = 3 }
            rawConfiguration = {
              legend = { enabled = true }
              nrqlQueries = [
                {
                  accountId = var.newrelic_account_id
                  query     = "SELECT rate(sum(post_generation_issues_total), 1 minute) AS `issues/min` FROM ${local.metric_source} FACET rule TIMESERIES AUTO ${local.lookback}"
                }
              ]
              yAxisLeft = { zero = true }
            }
            visualization = { id = "viz.bar" }
          },
        ]
      },
    ]
  })
}
