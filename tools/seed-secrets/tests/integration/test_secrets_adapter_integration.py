from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError

from src.core.exceptions import SecretsWriteError
from src.domain.schemas import SecretPayload
from src.infrastructure.secrets_manager import Boto3SecretsManager


def _client_error(code: str, msg: str = "error") -> ClientError:
    return ClientError({"Error": {"Code": code, "Message": msg}}, "Op")


@pytest.mark.integration
def test_upsert_create_when_not_found() -> None:
    client = MagicMock()
    client.describe_secret.side_effect = _client_error("ResourceNotFoundException")
    client.create_secret.return_value = {"ARN": "arn:created"}
    mgr = Boto3SecretsManager(region="ap-south-1", endpoint_url="http://localhost:4566", client=client)
    payload = SecretPayload(name="detectai/web/secrets", data={"A": "b"})
    status = mgr.upsert(payload)
    assert status == "created"
    client.create_secret.assert_called_once()
    client.put_secret_value.assert_not_called()


@pytest.mark.integration
def test_upsert_update_when_exists() -> None:
    client = MagicMock()
    client.describe_secret.return_value = {"Name": "detectai/web/secrets"}
    mgr = Boto3SecretsManager(region="ap-south-1", endpoint_url="http://localhost:4566", client=client)
    payload = SecretPayload(name="detectai/web/secrets", data={"A": "b"})
    status = mgr.upsert(payload)
    assert status == "updated"
    client.put_secret_value.assert_called_once()
    client.create_secret.assert_not_called()


@pytest.mark.integration
def test_upsert_handles_resource_exists_race() -> None:
    client = MagicMock()
    client.describe_secret.side_effect = _client_error("ResourceNotFoundException")
    client.create_secret.side_effect = _client_error("ResourceExistsException")
    client.put_secret_value.return_value = {"ARN": "updated"}
    mgr = Boto3SecretsManager(region="ap-south-1", endpoint_url="http://localhost:4566", client=client)
    payload = SecretPayload(name="detectai/web/secrets", data={"A": "b"})
    status = mgr.upsert(payload)
    assert status == "updated"
    client.put_secret_value.assert_called_once()


@pytest.mark.integration
def test_upsert_dry_run_no_client_call() -> None:
    client = MagicMock()
    mgr = Boto3SecretsManager(region="ap-south-1", endpoint_url=None, client=client)
    payload = SecretPayload(name="detectai/web/secrets", data={"A": "b"})
    status = mgr.upsert(payload, dry_run=True)
    assert status == "dry-run"
    client.describe_secret.assert_not_called()


@pytest.mark.integration
def test_upsert_wraps_other_error_with_secret_name() -> None:
    client = MagicMock()
    client.describe_secret.side_effect = Exception("boom secretstring leak")
    mgr = Boto3SecretsManager(region="ap-south-1", endpoint_url=None, client=client)
    payload = SecretPayload(name="detectai/web/secrets", data={"A": "b"})
    with pytest.raises(SecretsWriteError) as ei:
        mgr.upsert(payload)
    assert ei.value.secret_name == "detectai/web/secrets"
    # redacted message contains hint
    assert "redacted" in str(ei.value).lower()


@pytest.mark.integration
def test_list_secrets_delegates() -> None:
    client = MagicMock()
    client.list_secrets.return_value = {"SecretList": [{"Name": "detectai/web/secrets"}, {"Name": "other"}]}
    mgr = Boto3SecretsManager(region="ap-south-1", endpoint_url=None, client=client)
    names = mgr.list_secrets()
    assert "detectai/web/secrets" in names


@pytest.mark.integration
def test_client_factory_injection() -> None:
    called: dict = {}

    def factory(region, endpoint_url):  # type: ignore[no-untyped-def]
        called["region"] = region
        called["endpoint"] = endpoint_url
        m = MagicMock()
        m.describe_secret.side_effect = _client_error("ResourceNotFoundException")
        m.create_secret.return_value = {"ARN": "arn"}
        return m

    mgr = Boto3SecretsManager(region="eu-west-1", endpoint_url="http://localhost:4566", client_factory=factory)
    payload = SecretPayload(name="detectai/web/secrets", data={"A": "b"})
    status = mgr.upsert(payload)
    assert status == "created"
    assert called["region"] == "eu-west-1"
