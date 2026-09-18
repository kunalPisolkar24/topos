"""CLI parser — testable without subprocess."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from src.domain.schemas import SeedConfig


def _parse_only(value: str | None) -> frozenset[str] | None:
    if not value:
        return None
    parts = [p.strip() for p in value.split(",") if p.strip()]
    return frozenset(parts) if parts else None


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Seed frontend config (SSM) and app secrets (SM) from .env into Floci/LocalStack or real AWS.",
        epilog="Example: python main.py --env-file infrastructure/docker/prod/.env --endpoint-url http://localhost:4566",
    )
    p.add_argument(
        "--env-file",
        default="infrastructure/docker/prod/.env",
        help="Path to .env file (default: infrastructure/docker/prod/.env)",
    )
    p.add_argument(
        "--endpoint-url",
        default=None,
        help="AWS endpoint URL. Empty/omit = real AWS. Floci example: http://localhost:4566",
    )
    p.add_argument("--region", default="ap-south-1", help="AWS region (default: ap-south-1)")
    p.add_argument("--dry-run", action="store_true", help="Preview without writing")
    p.add_argument(
        "--only",
        default=None,
        help="Comma-separated secret/param names to limit (e.g. /topos/frontend/config,detectai/web/secrets)",
    )
    p.add_argument("--force", action="store_true", help="Allow overwriting TF-managed secrets")
    p.add_argument(
        "--confirm-prod",
        action="store_true",
        help="Required when writing to real AWS (empty endpoint) without --dry-run",
    )
    p.add_argument("--verbose", action="store_true", help="Verbose logging")
    return p


def parse_args(argv: list[str] | None = None) -> tuple[SeedConfig, bool]:
    """Parse argv into (SeedConfig, verbose).

    Handles AWS_ENDPOINT_URL env fallback and "" -> None normalization.
    """
    parser = build_parser()
    args = parser.parse_args(argv)

    endpoint = args.endpoint_url
    if endpoint == "":
        endpoint = None
    if endpoint is None and args.endpoint_url is None:
        endpoint = os.getenv("AWS_ENDPOINT_URL") or None
        if endpoint == "":
            endpoint = None

    only = _parse_only(args.only)

    # Resolve env-file relative to repo root if needed is done by loader, but we still create config
    # with raw path; loader will resolve.
    env_path = Path(args.env_file)

    config = SeedConfig(
        env_file=str(env_path),
        endpoint_url=endpoint,
        region=args.region,
        dry_run=args.dry_run,
        only=only,
        force=args.force,
        confirm_prod=args.confirm_prod,
    )
    return config, bool(args.verbose)
