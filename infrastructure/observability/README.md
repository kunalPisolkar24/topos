# New Relic observability stack — dashboards + alerts for Topos prod.
#
# Separate from `infrastructure/terraform` (Floci AWS mocks). This stack only
# needs New Relic creds and manages `newrelic_one_dashboard_json` + NRQL alerts
# over OTEL spans sent by `infrastructure/docker/prod/otel-collector`.
#
# Files:
# - versions.tf: tf + newrelic provider pins
# - providers.tf: account_id / api_key (NRAK-...) / region (US|EU)
# - variables.tf: inputs
# - dashboards.tf: overview dashboard + golden-signal alerts
