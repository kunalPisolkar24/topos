# Terraform workflow

Use root Makefile targets so commands consistently choose the repository's
Terraform directory and environment variable file.

```mermaid
flowchart LR
    change[Review change] --> plan[make infra-plan ENV=floci]
    plan --> apply[make infra-up ENV=floci]
    apply --> output[make infra-output]
    output --> seed[Optional approved secret seed]
    seed --> deploy[make prod-up]
    deploy --> verify[Health and telemetry verification]
```

## Common commands

```bash
make infra-plan ENV=floci
make infra-up ENV=floci
make infra-output
make infra-test-unit
make infra-test-floci ENV=floci
```

`prod-up` can optionally apply infrastructure first with `WITH_INFRA=1`. It can
optionally seed app values with `SEED_SECRETS=1`; neither action is the default.
This avoids turning an ordinary restart into an infrastructure change or a
secret overwrite.

> [!WARNING]
> A destroy operation is destructive. Production destroy additionally requires
> `CONFIRM_DESTROY=1`, but that is a guard, not a replacement for reviewing the
> selected account, state backend, variables, and plan.
