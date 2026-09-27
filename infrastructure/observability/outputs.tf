output "dashboard_permalink" {
  description = "New Relic URL of the Topos observability dashboard"
  value       = newrelic_one_dashboard_json.topos.permalink
}

output "alert_policy_id" {
  description = "New Relic alert policy ID for golden-signal conditions"
  value       = newrelic_alert_policy.topos.id
}
