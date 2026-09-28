output "dashboard_permalink" {
  description = "New Relic URL of the Topos observability dashboard"
  value       = newrelic_one_dashboard_json.topos.permalink
}

output "dashboard_content_api_permalink" {
  description = "New Relic URL of the Content API dashboard"
  value       = newrelic_one_dashboard_json.content_api.permalink
}

output "dashboard_workers_permalink" {
  description = "New Relic URL of the Workers & Kafka dashboard"
  value       = newrelic_one_dashboard_json.content_workers.permalink
}

output "dashboard_ai_permalink" {
  description = "New Relic URL of the AI Service dashboard"
  value       = newrelic_one_dashboard_json.ai.permalink
}

output "dashboard_user_permalink" {
  description = "New Relic URL of the User Service dashboard"
  value       = newrelic_one_dashboard_json.user.permalink
}

output "dashboard_gateway_permalink" {
  description = "New Relic URL of the Gateway dashboard"
  value       = newrelic_one_dashboard_json.gateway.permalink
}

output "dashboard_logs_permalink" {
  description = "New Relic URL of the Logs dashboard"
  value       = newrelic_one_dashboard_json.logs.permalink
}

output "alert_policy_id" {
  description = "New Relic alert policy ID for golden-signal conditions"
  value       = newrelic_alert_policy.topos.id
}
