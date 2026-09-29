# Testing Seed Secrets

Run commands from `tools/seed-secrets/`:

```bash
make lint       # Ruff static checks
make format     # Verify formatting
make test       # Unit tests, no integration marker
make test-all   # Unit and integration-marked tests
make test-cov   # Unit tests with the configured coverage threshold
```

The tests cover parsing, payload building, guards, configuration selection, and
AWS adapter behaviour. The project test settings live in
[`pyproject.toml`](../../pyproject.toml).

When changing the mapping or a guard, add a test for both the accepted case and
the unsafe case it protects against.
