# Testing

This document explains how to test the Seed Secrets tool. Testing ensures the tool works correctly and catches issues before seeding real secrets.

## Why Test?

Testing helps you:
- **Catch bugs early** — Find problems before they affect production secrets
- **Ensure correctness** — Verify allowlist filtering, shared key sync, and guards work
- **Enable changes** — Safely modify code knowing tests will catch mistakes
- **Document behavior** — Tests show how the tool should behave

## Testing Levels

The Seed Secrets tool has two levels of testing, each with different tradeoffs:

### Unit Tests

**What they are:** Tests that check individual parts of the code in isolation, using fake implementations.

**When to use:** Every time you change code.

**Speed:** Fast (seconds).

**Dependencies:** None (no network, no AWS, no real filesystem).

```bash
# Run unit tests
make test

# Run with coverage report
make test-cov
```

**Example:** Testing that the use case generates shared keys and syncs them across secrets.

### Integration Tests

**What they are:** Tests that check multiple parts working together. The AWS Secrets Manager is mocked, but filesystem operations use real temporary directories.

**When to use:** Before committing code.

**Speed:** Medium (seconds, but slower than unit tests).

**Dependencies:** None (mocked AWS, `tmp_path` for filesystem).

```bash
# Run all tests (unit + integration)
make test-all
```

**Example:** Testing that the composition root correctly wires all components and the Boto3 adapter handles create/update/race-condition paths.

## Choosing Which Tests to Run

| Change Type | Run These Tests |
|-------------|-----------------|
| Small bug fix | Unit tests |
| New feature | Unit + Integration |
| Allowlist changes | Unit + Integration |
| CLI argument changes | Unit tests |
| AWS adapter changes | Unit + Integration |
| Quick check | Unit tests |
| Before commit | All tests |

## Test Structure

```
tools/seed-secrets/tests/
├── conftest.py                                    # Shared fixtures (clear settings cache)
├── unit/
│   ├── test_schemas.py                            # SeedConfig / SecretPayload validation
│   ├── test_seed_use_case.py                      # SeedUseCase with deterministic key_gen
│   ├── test_config_provider.py                    # Settings provider, caching, env fallback
│   └── test_cli_parser.py                         # CLI argument parsing
├── integration/
│   ├── test_composition_integration.py            # Full wiring with mocked boto3 client
│   ├── test_secrets_adapter_integration.py        # Boto3SecretsManager CRUD paths
│   └── test_loader_integration.py                 # LocalEnvLoader file resolution
├── test_seeder.py                                 # Legacy unit tests (FakeStore)
└── test_env_parser.py                             # Dotenv parser tests
```

## Test Doubles (Fakes)

The tests use **fake implementations** instead of real ones. This is possible because the tool uses interfaces (ports).

### FakeStore

Implements `ISecretsStore` without touching AWS:

```python
class FakeStore(ISecretsStore):
    def __init__(self):
        self.upserted: list[tuple[str, str]] = []

    def upsert(self, payload, dry_run=False):
        self.upserted.append((payload.name, "created"))
        return "created"

    def list_secrets(self):
        return [name for name, _ in self.upserted]
```

### Deterministic Key Generation

Tests inject a deterministic `key_gen` to avoid random values:

```python
# Always generates "aa...aa" (2*n bytes of "a")
key_gen = lambda n: "a" * (2 * n)
uc = SeedUseCase(store=FakeStore(), key_gen=key_gen)
```

### Mocked Boto3 Client

Integration tests use `MagicMock` to simulate the AWS client:

```python
client = MagicMock()
client.describe_secret.side_effect = ClientError(
    {"Error": {"Code": "ResourceNotFoundException"}}, "DescribeSecret"
)
client.create_secret.return_value = {}

store = Boto3SecretsManager(region="us-east-1", endpoint_url=None, client=client)
```

## Test Coverage

Coverage shows what percentage of your code is tested.

```bash
# Generate coverage report
make test-cov

# View coverage in browser
poetry -C tools/seed-secrets run coverage html
open htmlcov/index.html
```

### Coverage Goals

| Code Type | Target Coverage |
|-----------|-----------------|
| Domain schemas | > 90% |
| Use cases | > 85% |
| Env parser | > 80% |
| Infrastructure adapters | > 65% |
| **Overall** | **> 65%** (enforced by CI) |

The CI pipeline enforces a **65% minimum** coverage gate.

## Running Tests

### Quick Reference

| Command | What It Runs | Speed |
|---------|--------------|-------|
| `make test` | Unit tests only | Fast |
| `make test-all` | Unit + Integration | Medium |
| `make test-cov` | Unit tests with coverage report | Fast |
| `make lint` | Ruff linter | Fast |

### Unit Tests

```bash
# From project root
make -C tools/seed-secrets test

# Or with Poetry directly
poetry -C tools/seed-secrets run pytest -q -m "not integration"
```

### All Tests

```bash
# From project root
make -C tools/seed-secrets test-all

# Or with Poetry directly
poetry -C tools/seed-secrets run pytest -q
```

### With Coverage

```bash
# From project root
make -C tools/seed-secrets test-cov

# Or with Poetry directly
poetry -C tools/seed-secrets run pytest -m "not integration" --cov=src --cov-report=term-missing --cov-fail-under=65
```

### Linting

```bash
# Check for lint errors
make -C tools/seed-secrets lint

# Check formatting
make -C tools/seed-secrets format
```

## Writing Tests

### Unit Test Pattern

```python
def test_build_payloads_filters_to_allowlist(tmp_path):
    # Arrange
    store = FakeStore()
    uc = SeedUseCase(store=store, key_gen=lambda n: "a" * (2 * n))

    env = {
        "NEXTAUTH_SECRET": "secret123",
        "DATABASE_URL": "postgres://...",  # Not allowlisted
        "GOOGLE_ID": "google-id",
    }

    # Act
    payloads = uc.build_payloads(env)

    # Assert
    assert len(payloads) == 1  # Only web secret has matching keys
    assert payloads[0].name == "detectai/web/secrets"
    assert "NEXTAUTH_SECRET" in payloads[0].data
    assert "GOOGLE_ID" in payloads[0].data
    assert "DATABASE_URL" not in payloads[0].data  # Filtered out
```

### Integration Test Pattern

```python
@pytest.mark.integration
def test_composition_build_and_dry_run(tmp_path, tmp_assets):
    # Arrange
    settings = Settings(region="us-east-1", endpoint_url="http://localhost:4566")
    client = MagicMock()

    # Act
    seeder, loader = build_seeder(settings, client=client)
    result = seeder.seed(config, env)

    # Assert
    assert result[1] == []  # No generated keys
    client.put_secret_value.assert_not_called()  # Dry-run
```

### Testing Guard Paths

```python
def test_guard_blocks_tf_managed_without_force():
    config = SeedConfig(
        env_file=".env",
        only=frozenset({"detectai/pg/urls"}),
        force=False,
    )

    with pytest.raises(GuardError, match="without --force"):
        seeder.seed(config, env)
```

## Common Testing Issues

### "No module named src"

**Problem:** Tests fail with import errors.

**Solution:** Make sure you're running from the `tools/seed-secrets` directory, or use `poetry run`:

```bash
poetry -C tools/seed-secrets run pytest
```

### "Coverage below 65%"

**Problem:** The coverage gate fails.

**Solution:** Check which files have low coverage and add tests. The `--cov-report=term-missing` flag shows uncovered lines.

### "Settings leaking between tests"

**Problem:** Tests fail intermittently because settings from one test affect another.

**Solution:** The `conftest.py` fixture automatically clears the settings cache between every test. If you're adding new tests, ensure they don't cache settings.

## CI Pipeline

The GitHub Actions workflow runs on every push to `tools/seed-secrets/**`:

1. **Lint** — `ruff check .`
2. **Unit tests** — `pytest -m "not integration"` with 65% coverage gate
3. **Integration tests** — `pytest -m integration`

Feature branches targeting `dev` don't run CI automatically. Paste local `make lint/test` output in your PR.

## Best Practices

1. **Write tests before fixing bugs** — Ensure the bug exists, then write a test that catches it
2. **Keep tests simple** — Each test should test one thing
3. **Use descriptive names** — Test names should explain what they test
4. **Use fakes over mocks** — Fake implementations are clearer than mock chains
5. **Use `tmp_path` for filesystem tests** — Auto-cleaned, no leftover files
6. **Run tests frequently** — Don't wait until the end to test

## Related Documentation

- [Architecture](../concepts/architecture.md) — How the testable design works
- [Configuration](../getting-started/configuration.md) — Settings for test environments
- [Seeding Flow](../concepts/seeding-flow.md) — What the tests verify
