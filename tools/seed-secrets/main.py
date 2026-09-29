"""Thin bootstrap — parse args, wire container, run use-case."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.cli.parser import parse_args  # noqa: E402
from src.core.constants import EXIT_CODE_RUNTIME, EXIT_CODE_USAGE  # noqa: E402
from src.core.exceptions import EnvParseError, GuardError, SecretsWriteError  # noqa: E402
from src.core.logging import configure_logging  # noqa: E402
from src.infrastructure.composition.container import build_seeder  # noqa: E402
from src.infrastructure.config.provider import get_settings  # noqa: E402


def main(argv: list[str] | None = None) -> None:
    # Parse first (need verbose for logging)
    config, verbose = parse_args(argv)

    configure_logging(verbose=verbose)

    # Also load settings for validation / env consistency (not strictly required for seed, but keeps parity)
    try:
        settings = get_settings()
    except Exception as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(EXIT_CODE_USAGE)

    # Banner (never prints values)
    target = "real AWS" if config.is_real_aws else f"Floci ({config.endpoint_url})"
    # Resolve env path for display via loader
    from src.infrastructure.filesystem.env_loader import LocalEnvLoader  # noqa: E402

    loader = LocalEnvLoader()
    env_path = loader.resolve_path(config.env_file)

    if config.dry_run:
        print(f"[dry-run] target={target} region={config.region} env-file={env_path}")
    else:
        print(f"target={target} region={config.region} env-file={env_path}")

    if config.is_real_aws and not config.confirm_prod and not config.dry_run:
        print("ERROR: writing to real AWS requires --confirm-prod (or --dry-run to preview)", file=sys.stderr)
        sys.exit(EXIT_CODE_USAGE)

    # Load env file via loader (sole FS place)
    try:
        # Build loader/seeder via container (use settings region/endpoint as defaults, but config overrides)
        seeder, env_loader = build_seeder(
            settings,
            endpoint_url=config.endpoint_url,
            region=config.region,
        )
        env = env_loader.load(str(env_path))
    except EnvParseError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(EXIT_CODE_USAGE)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(EXIT_CODE_USAGE)

    from src.domain.constants import ALLOWLIST  # noqa: E402

    found = sorted(k for k in env if k in ALLOWLIST and env[k] != "")
    if found:
        print(f"found {len(found)} allowlisted keys in {env_path.name}: {', '.join(found)}")
    else:
        print(f"warning: no allowlisted keys found in {env_path} (found keys: {', '.join(sorted(env.keys())[:10])})")

    # Execute seeding (seeder already built, but we rebuilt above; reuse that instance)
    # Rebuild to ensure same instance used for payload counting — use the same seeder
    try:
        results, generated = seeder.seed(config, env)
    except GuardError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(EXIT_CODE_USAGE)
    except SecretsWriteError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(EXIT_CODE_RUNTIME)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(EXIT_CODE_RUNTIME)

    for name, status in results:
        payload_keys = next((len(p.data) for p in seeder.build_payloads(env, only=config.only) if p.name == name), "?")
        print(f"{status:8s} {name} ({payload_keys} keys)")

    if generated:
        print(f"\nGenerated {len(generated)} keys (not in .env, created once and synced):")
        for g in generated:
            print(f"  - {g}")
        print("\nHint: add generated values to your .env to keep them stable across runs.")
        print("  e.g. run with --dry-run first, copy values after real seed, or let the seeder generate and persist.")

    if config.dry_run:
        print("\n[dry-run] no secrets were written.")
    else:
        print(f"\nDone. Wrote {len(results)} secrets to {target}.")

    if not config.dry_run:
        endpoint_display = config.endpoint_url or f"https://secretsmanager.{config.region}.amazonaws.com"
        print(
            f"\nVerify SM: aws --endpoint-url {endpoint_display} --region {config.region} secretsmanager list-secrets --query 'SecretList[].Name'"
        )
        print(
            f"Verify SSM: aws --endpoint-url {endpoint_display} --region {config.region} ssm describe-parameters --query 'Parameters[].Name' | grep topos"
        )


if __name__ == "__main__":
    main()
