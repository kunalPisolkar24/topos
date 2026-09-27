# New Relic observability stack

Separate from `infrastructure/terraform` (Floci AWS mocks). This stack manages
the New Relic dashboard and golden-signal NRQL alerts over OTEL data sent by
`infrastructure/docker/prod/otel-collector`.

## Structure

- `dashboards.tf` — overview dashboard.
- `alerts.tf` — alert policy and conditions.
- `locals.tf` — environment-scoped NRQL fragments.
- `tests/` — mocked Terraform contracts and a read-only New Relic smoke test.

## Test

```bash
# Mocked provider contracts; no New Relic account required.
make obs-test-unit

# After applying the stack, verify the account can run NRQL and contains the
# expected dashboard. This is read-only and needs a user API key.
export NEW_RELIC_API_KEY=NRAK-...
export NEW_RELIC_ACCOUNT_ID=1234567
make obs-test-live
```

Dashboard permissions default to `PRIVATE`. Override
`dashboard_permissions` only when a broader sharing policy is explicitly
required. All dashboard and alert NRQL is scoped to `environment` through the
`deployment.environment` OTEL resource attribute.
