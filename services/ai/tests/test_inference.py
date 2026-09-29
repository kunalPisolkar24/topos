"""Unit tests for EMBEDDING_MODE=inference (Qdrant server-side inference).

In inference mode the dense channel carries models.Document payloads that
Qdrant Cloud embeds with the configured model; the service never handles
dense vectors on that path. The sparse channel, payloads, fusion, and the
id-based related/profile paths behave exactly as in client-side modes.
"""

import uuid
from types import SimpleNamespace

import grpc
import pytest
from qdrant_client import models

from src.config import settings
from src.embeddings import EmbeddingError, FakeEmbeddingClient, NoopEmbeddingClient
from src.graphs.retrieval import DenseSource
from src.vector import DENSE_VECTOR, MemoryIndex, SearchIndex, _inference_mode

POST_A = "6a75a41221a9752ec47bc60a"


@pytest.fixture
def inference_mode(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "EMBEDDING_MODE", "inference")
    monkeypatch.setattr(settings, "EMBEDDING_MODEL", "test-model")
    assert _inference_mode()


class RecordingClient:
    """Stand-in for AsyncQdrantClient that records calls, no network."""

    def __init__(self, points=None) -> None:
        self.upserted: list = []
        self.queries: list = []
        self.points = points or []

    async def upsert(self, collection_name, points):
        self.upserted.extend(points)

    async def query_points(self, **kwargs):
        self.queries.append(kwargs)
        return SimpleNamespace(points=list(self.points))

    async def close(self) -> None:
        return None


def _point(post_id: str = POST_A):
    return SimpleNamespace(
        id=uuid.uuid4(),
        payload={"title": "t", "body": "b"},
    )


async def test_noop_embed_raises() -> None:
    with pytest.raises(EmbeddingError):
        await NoopEmbeddingClient().embed(["text"])


async def test_upsert_uses_document_in_inference_mode(inference_mode) -> None:
    client = RecordingClient()
    index = SearchIndex(NoopEmbeddingClient(), client)  # type: ignore[arg-type]

    await index.upsert(POST_A, "title", "body", "summary", ["tag"], "2026-01-01")

    assert len(client.upserted) == 1
    dense = client.upserted[0].vector[DENSE_VECTOR]
    assert isinstance(dense, models.Document)
    assert dense.model == "test-model"
    assert "title" in dense.text
    # Sparse channel still computed locally.
    assert client.upserted[0].vector["sparse"] is not None


async def test_upsert_embeds_client_side_by_default() -> None:
    client = RecordingClient()
    index = SearchIndex(FakeEmbeddingClient(), client)  # type: ignore[arg-type]

    await index.upsert(POST_A, "title", "body", "summary", [], "2026-01-01")

    dense = client.upserted[0].vector[DENSE_VECTOR]
    assert isinstance(dense, list)
    assert len(dense) == settings.QDRANT_VECTOR_SIZE


async def test_search_prefetch_uses_document_in_inference_mode(inference_mode) -> None:
    client = RecordingClient(points=[_point()])
    index = SearchIndex(NoopEmbeddingClient(), client)  # type: ignore[arg-type]

    result = await index.search("some query", 0, 10)

    assert result.total == 1
    prefetch = client.queries[0]["prefetch"]
    assert isinstance(prefetch[0].query, models.Document)
    assert prefetch[0].query.model == "test-model"
    assert prefetch[0].query.text == "some query"


async def test_retrieve_by_text_sends_document(inference_mode) -> None:
    client = RecordingClient(points=[_point()])
    index = SearchIndex(NoopEmbeddingClient(), client)  # type: ignore[arg-type]

    posts = await index.retrieve_by_text("grounding query", 5)

    assert len(posts) == 1
    query = client.queries[0]
    assert isinstance(query["query"], models.Document)
    assert query["query"].text == "grounding query"
    assert query["score_threshold"] == settings.SEARCH_DENSE_SCORE_THRESHOLD


async def test_memory_retrieve_by_text_rejects_inference_mode(inference_mode) -> None:
    index = MemoryIndex(FakeEmbeddingClient())

    with pytest.raises(EmbeddingError):
        await index.retrieve_by_text("query", 5)


async def test_dense_source_uses_text_path_in_inference_mode(inference_mode) -> None:
    seen: list = []

    class StubSearch:
        async def retrieve_by_text(self, text, top_k):
            seen.append((text, top_k))
            return []

    source = DenseSource(StubSearch(), NoopEmbeddingClient())  # type: ignore[arg-type]
    await source.fetch("chat query", 3)

    assert seen == [("chat query", 3)]


async def test_embed_rpc_unimplemented_in_inference_mode(
    stub, monkeypatch: pytest.MonkeyPatch
) -> None:
    from src.generated import ai_service_pb2

    monkeypatch.setattr(settings, "EMBEDDING_MODE", "inference")

    with pytest.raises(grpc.aio.AioRpcError) as exc_info:
        await stub.Embed(ai_service_pb2.EmbedRequest(text="hello"))

    assert exc_info.value.code() == grpc.StatusCode.UNIMPLEMENTED


async def test_embed_rpc_still_works_client_side(stub) -> None:
    from src.generated import ai_service_pb2

    response = await stub.Embed(ai_service_pb2.EmbedRequest(text="hello"))

    assert len(response.vector) == settings.QDRANT_VECTOR_SIZE
