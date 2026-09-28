# Safety guards

The tool refuses dangerous operations by default. These checks are implemented
in [`src/application/use_cases.py`](../../src/application/use_cases.py).

## Real AWS confirmation

If `--endpoint-url` is empty, a real write requires `--confirm-prod`. Use
`--dry-run` to inspect the operation first.

## Terraform-managed secrets

Some infrastructure credentials are generated and owned by Terraform. Selecting
one of these destinations without `--force` is refused so a seed cannot
silently replace it.

## Container-unreachable hosts

When targeting Floci, connection values using `localhost`, `127.0.0.1`, `::1`,
or `0.0.0.0` are refused for data-plane URLs. A container cannot reach the
operator's loopback interface. Use the correct Docker service hostname instead.

## Unknown destinations

`--only` accepts only known application or Terraform-managed destination names.
A typo is an error rather than a no-op.

> [!WARNING]
> `--force` permits operations that guards intentionally block. Use it only
> after verifying the destination, environment file, and each connection host.
