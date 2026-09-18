"""Boto3 adapters — Secrets Manager + SSM Parameter Store (Floci/LocalStack aware)."""

from __future__ import annotations

import json
import os
from typing import Any

from src.core.exceptions import SecretsWriteError
from src.domain.schemas import SecretPayload
from src.interfaces.secrets_store import ISecretsStore


def is_floci_endpoint(endpoint: str | None) -> bool:
    if not endpoint:
        return False
    return (
        "localhost:4566" in endpoint
        or "127.0.0.1:4566" in endpoint
        or "host.docker.internal:4566" in endpoint
    )


def _redact_error_message(msg: str) -> str:
    lower = msg.lower()
    if "token" in lower or "secretstring" in lower or "bearer" in lower:
        return "Secrets Manager error (redacted — contains secret material)"
    if "parametervalue" in lower or "secure" in lower:
        return "SSM error (redacted — contains parameter material)"
    return msg


def _is_ssm_param(name: str) -> bool:
    return name.startswith("/topos/")


class Boto3SecretsManager(ISecretsStore):
    def __init__(
        self,
        region: str,
        endpoint_url: str | None,
        client: Any | None = None,
        client_factory: Any | None = None,
    ) -> None:
        self.region = region
        self.endpoint_url = endpoint_url if endpoint_url else None
        self._client = client
        self._client_factory = client_factory

    @classmethod
    def from_settings(cls, settings: Any, client: Any | None = None) -> "Boto3SecretsManager":  # type: ignore[no-untyped-def]
        return cls(region=settings.region, endpoint_url=settings.endpoint_url, client=client)

    def _create_client(self):  # type: ignore[no-untyped-def]
        if self._client is not None:
            return self._client
        if self._client_factory is not None:
            return self._client_factory(region=self.region, endpoint_url=self.endpoint_url)

        try:
            import boto3  # type: ignore
            from botocore.exceptions import ClientError  # noqa: F401
        except ImportError as e:
            raise SecretsWriteError("boto3 is required (pip install boto3)") from e

        import boto3  # type: ignore

        kwargs: dict[str, Any] = {"region_name": self.region}
        if self.endpoint_url:
            kwargs["endpoint_url"] = self.endpoint_url
        if is_floci_endpoint(self.endpoint_url) and not os.getenv("AWS_ACCESS_KEY_ID"):
            kwargs["aws_access_key_id"] = "test"
            kwargs["aws_secret_access_key"] = "test"
        return boto3.client("secretsmanager", **kwargs)

    def _client_instance(self):  # type: ignore[no-untyped-def]
        # allow test injection via _client
        if self._client is not None:
            return self._client
        return self._create_client()

    def upsert(self, payload: SecretPayload, dry_run: bool = False) -> str:
        if dry_run:
            return "dry-run"
        client = self._client_instance()
        secret_string = json.dumps(payload.data, separators=(",", ":"))
        try:
            from botocore.exceptions import ClientError  # type: ignore

            try:
                client.describe_secret(SecretId=payload.name)
                client.put_secret_value(SecretId=payload.name, SecretString=secret_string)
                return "updated"
            except ClientError as e:
                code = e.response.get("Error", {}).get("Code", "")
                if code in ("ResourceNotFoundException", "InvalidRequestException"):
                    try:
                        client.create_secret(Name=payload.name, SecretString=secret_string)
                        return "created"
                    except ClientError as ce2:
                        if ce2.response.get("Error", {}).get("Code") == "ResourceExistsException":
                            client.put_secret_value(SecretId=payload.name, SecretString=secret_string)
                            return "updated"
                        raise
                if "not found" in str(e).lower():
                    client.create_secret(Name=payload.name, SecretString=secret_string)
                    return "created"
                raise
        except SecretsWriteError:
            raise
        except Exception as e:
            msg = _redact_error_message(str(e))
            raise SecretsWriteError(f"failed to upsert {payload.name}: {msg}", secret_name=payload.name) from e

    def list_secrets(self) -> list[str]:
        client = self._client_instance()
        try:
            out = client.list_secrets()
        except Exception as e:
            msg = _redact_error_message(str(e))
            raise SecretsWriteError(f"failed to list secrets: {msg}") from e
        return [s.get("Name", "") for s in out.get("SecretList", []) if s.get("Name")]


class Boto3ParameterStore(ISecretsStore):
    """SSM Parameter Store adapter — JSON blob in a single String parameter."""

    def __init__(
        self,
        region: str,
        endpoint_url: str | None,
        client: Any | None = None,
        client_factory: Any | None = None,
    ) -> None:
        self.region = region
        self.endpoint_url = endpoint_url if endpoint_url else None
        self._client = client
        self._client_factory = client_factory

    @classmethod
    def from_settings(cls, settings: Any, client: Any | None = None) -> "Boto3ParameterStore":  # type: ignore[no-untyped-def]
        return cls(region=settings.region, endpoint_url=settings.endpoint_url, client=client)

    def _create_client(self):  # type: ignore[no-untyped-def]
        if self._client is not None:
            return self._client
        if self._client_factory is not None:
            return self._client_factory(region=self.region, endpoint_url=self.endpoint_url)

        try:
            import boto3  # type: ignore
            from botocore.exceptions import ClientError  # noqa: F401
        except ImportError as e:
            raise SecretsWriteError("boto3 is required (pip install boto3)") from e

        import boto3  # type: ignore

        kwargs: dict[str, Any] = {"region_name": self.region}
        if self.endpoint_url:
            kwargs["endpoint_url"] = self.endpoint_url
        if is_floci_endpoint(self.endpoint_url) and not os.getenv("AWS_ACCESS_KEY_ID"):
            kwargs["aws_access_key_id"] = "test"
            kwargs["aws_secret_access_key"] = "test"
        return boto3.client("ssm", **kwargs)

    def _client_instance(self):  # type: ignore[no-untyped-def]
        if self._client is not None:
            return self._client
        return self._create_client()

    def upsert(self, payload: SecretPayload, dry_run: bool = False) -> str:
        if dry_run:
            return "dry-run"
        client = self._client_instance()
        value = json.dumps(payload.data, separators=(",", ":"))
        try:
            from botocore.exceptions import ClientError  # type: ignore

            exists = False
            try:
                client.get_parameter(Name=payload.name)
                exists = True
            except ClientError as e:
                code = e.response.get("Error", {}).get("Code", "")
                if code in ("ParameterNotFound", "InvalidRequestException"):
                    exists = False
                elif "not found" in str(e).lower():
                    exists = False
                else:
                    raise
            client.put_parameter(
                Name=payload.name,
                Value=value,
                Type="String",
                Overwrite=True,
                Tier="Standard",
            )
            return "updated" if exists else "created"
        except SecretsWriteError:
            raise
        except Exception as e:
            msg = _redact_error_message(str(e))
            raise SecretsWriteError(f"failed to upsert {payload.name}: {msg}", secret_name=payload.name) from e

    def list_secrets(self) -> list[str]:
        client = self._client_instance()
        try:
            paginator = client.get_paginator("describe_parameters")
            names: list[str] = []
            for page in paginator.paginate(ParameterFilters=[{"Key": "Name", "Option": "BeginsWith", "Values": ["/topos/"]}]):
                for p in page.get("Parameters", []):
                    n = p.get("Name", "")
                    if n:
                        names.append(n)
            if not names:
                # fallback: no filter (LocalStack may not support ParameterFilters)
                out = client.describe_parameters()
                for p in out.get("Parameters", []):
                    n = p.get("Name", "")
                    if n and n.startswith("/topos/"):
                        names.append(n)
            return names
        except Exception as e:
            msg = _redact_error_message(str(e))
            raise SecretsWriteError(f"failed to list parameters: {msg}") from e


class HybridStore(ISecretsStore):
    """Routes payloads to SSM (/_topos/...) or SM (rest) — single store for SeedUseCase."""

    def __init__(self, ssm: ISecretsStore, sm: ISecretsStore) -> None:
        self._ssm = ssm
        self._sm = sm

    @property
    def endpoint_url(self) -> str | None:  # type: ignore[no-untyped-def]
        # expose for tests that assert seeder.store.endpoint_url
        ssm_ep = getattr(self._ssm, "endpoint_url", None)
        sm_ep = getattr(self._sm, "endpoint_url", None)
        return ssm_ep if ssm_ep is not None else sm_ep

    @property
    def region(self) -> str | None:  # type: ignore[no-untyped-def]
        return getattr(self._ssm, "region", None) or getattr(self._sm, "region", None)

    def _route(self, name: str) -> ISecretsStore:
        return self._ssm if _is_ssm_param(name) else self._sm

    def upsert(self, payload: SecretPayload, dry_run: bool = False) -> str:
        return self._route(payload.name).upsert(payload, dry_run=dry_run)

    def list_secrets(self) -> list[str]:
        try:
            ssm_list = self._ssm.list_secrets()
        except Exception:
            ssm_list = []
        try:
            sm_list = self._sm.list_secrets()
        except Exception:
            sm_list = []
        return ssm_list + sm_list
