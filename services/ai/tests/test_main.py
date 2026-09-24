"""Unit tests for main.py composition factories."""

import pytest

from src import main
from src.config import settings
from src.embeddings import (
    FakeEmbeddingClient,
    NoopEmbeddingClient,
    OllamaEmbeddingClient,
)
from src.vector import MemoryIndex, SearchIndex


def test_build_embeddings_selects_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "EMBEDDING_MODE", "fake")
    assert isinstance(main.build_embeddings(), FakeEmbeddingClient)

    monkeypatch.setattr(settings, "EMBEDDING_MODE", "ollama")
    provider = main.build_embeddings()
    assert isinstance(provider, OllamaEmbeddingClient)

    monkeypatch.setattr(settings, "EMBEDDING_MODE", "inference")
    assert isinstance(main.build_embeddings(), NoopEmbeddingClient)


def test_build_search_selects_store(monkeypatch: pytest.MonkeyPatch) -> None:
    embeddings = FakeEmbeddingClient()

    monkeypatch.setattr(settings, "EMBEDDING_MODE", "fake")
    monkeypatch.setattr(settings, "VECTOR_MODE", "fake")
    assert isinstance(main.build_search(embeddings), MemoryIndex)

    monkeypatch.setattr(settings, "VECTOR_MODE", "qdrant")
    store = main.build_search(embeddings)
    assert isinstance(store, SearchIndex)


def test_build_search_rejects_inference_without_qdrant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "EMBEDDING_MODE", "inference")
    monkeypatch.setattr(settings, "VECTOR_MODE", "fake")

    with pytest.raises(RuntimeError, match="VECTOR_MODE=qdrant"):
        main.build_search(FakeEmbeddingClient())
