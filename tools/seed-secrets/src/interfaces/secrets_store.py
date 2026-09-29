from abc import ABC, abstractmethod
from src.domain.schemas import SecretPayload


class ISecretsStore(ABC):
    @abstractmethod
    def upsert(self, payload: SecretPayload, dry_run: bool = False) -> str:
        """Create or update a secret. Returns 'created'|'updated'|'dry-run'."""

    @abstractmethod
    def list_secrets(self) -> list[str]:
        """List existing secret names (for verify)."""
