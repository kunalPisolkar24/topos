import asyncio
from datetime import UTC, datetime
from uuid import uuid4

import grpc
import httpx
import pytest
from prometheus_client.registry import REGISTRY
from qdrant_client import AsyncQdrantClient

from src.config import settings
from src.embeddings import FakeEmbeddingClient
from src.generated import ai_service_pb2
from src.generated import ai_service_pb2_grpc as ai_stubs
from src.graphs.retrieval import DenseSource, HybridSource
from src.llm import LLMError
from src.vector import SearchIndex
from tests.support.fake_llm import FakeLLM
from tests.support.fakes import (
    FakeHTTPClient,
    FakeResponse,
    make_client,
    no_sleep,
    ok_response,
    stream_response,
)


def _llm_counter(status: str) -> float:
    return (
        REGISTRY.get_sample_value(
            "llm_requests_total", {"status": status, "model": settings.LLM_MODEL}
        )
        or 0.0
    )


def _tokens(method: str, token_type: str) -> float:
    return (
        REGISTRY.get_sample_value(
            "llm_tokens_total",
            {"method": method, "token_type": token_type, "model": settings.LLM_MODEL},
        )
        or 0.0
    )


def _grpc_counter(method: str, status: str) -> float:
    return (
        REGISTRY.get_sample_value(
            "grpc_requests_total", {"method": method, "status": status}
        )
        or 0.0
    )


def _recommend_counter(mode: str, status: str) -> float:
    return (
        REGISTRY.get_sample_value(
            "recommend_requests_total", {"method": mode, "status": status}
        )
        or 0.0
    )


def _recommend_duration_count(mode: str) -> float:
    return (
        REGISTRY.get_sample_value(
            "recommend_request_duration_seconds_count",
            {"method": mode, "status": "OK"},
        )
        or 0.0
    )


def _profile_updates(kind: str) -> float:
    return REGISTRY.get_sample_value("profile_updates_total", {"kind": kind}) or 0.0


def _cold_start_total() -> float:
    return REGISTRY.get_sample_value("recommend_cold_start_total") or 0.0


def _index_request(post_id: str, text: str) -> ai_service_pb2.IndexRequest:
    return ai_service_pb2.IndexRequest(
        post_id=post_id,
        title=text,
        body=f"<p>{text}</p>",
        summary=f"summary {text}",
        created_at=datetime.now(UTC),
    )


def _profile_update(
    user_id: str, post_id: str, kind: int
) -> ai_service_pb2.UserProfileUpdateRequest:
    return ai_service_pb2.UserProfileUpdateRequest(
        user_id=user_id, post_id=post_id, kind=kind
    )


async def test_grpc_metrics_record_success_status(running_server, fake_llm) -> None:
    channel, _ = running_server
    stub = ai_stubs.AIServiceStub(channel)
    fake_llm.response = "sum"

    before = _grpc_counter("/ai.AIService/GenerateSummary", "OK")
    await stub.GenerateSummary(ai_service_pb2.ContentRequest(text="hello"))

    assert _grpc_counter("/ai.AIService/GenerateSummary", "OK") == before + 1


async def test_grpc_metrics_record_error_status(running_server, fake_llm) -> None:
    channel, _ = running_server
    stub = ai_stubs.AIServiceStub(channel)
    fake_llm.error = LLMError("boom")

    before = _grpc_counter("/ai.AIService/GenerateSummary", "UNAVAILABLE")
    with pytest.raises(grpc.aio.AioRpcError):
        await stub.GenerateSummary(ai_service_pb2.ContentRequest(text="hello"))

    assert _grpc_counter("/ai.AIService/GenerateSummary", "UNAVAILABLE") == before + 1


async def test_grpc_metrics_record_internal_status(running_server, fake_llm) -> None:
    channel, _ = running_server
    stub = ai_stubs.AIServiceStub(channel)
    fake_llm.response = "not json"

    before = _grpc_counter("/ai.AIService/GenerateTags", "INTERNAL")
    with pytest.raises(grpc.aio.AioRpcError):
        await stub.GenerateTags(ai_service_pb2.ContextRequest(title="t", body="b"))

    assert _grpc_counter("/ai.AIService/GenerateTags", "INTERNAL") == before + 1


async def test_grpc_metrics_record_invalid_argument(running_server, fake_llm) -> None:
    channel, _ = running_server
    stub = ai_stubs.AIServiceStub(channel)

    before = _grpc_counter("/ai.AIService/GenerateSummary", "INVALID_ARGUMENT")
    with pytest.raises(grpc.aio.AioRpcError):
        await stub.GenerateSummary(ai_service_pb2.ContentRequest(text="x" * 5001))

    assert (
        _grpc_counter("/ai.AIService/GenerateSummary", "INVALID_ARGUMENT") == before + 1
    )


async def test_metrics_llm_success_and_error(monkeypatch) -> None:
    success_before = _llm_counter("success")
    error_before = _llm_counter("error")

    client = make_client(monkeypatch, FakeHTTPClient(responses=[ok_response()]))
    await client.generate_completion("s", "u")

    assert _llm_counter("success") == success_before + 1
    assert _llm_counter("error") == error_before

    bad = make_client(monkeypatch, FakeHTTPClient(responses=[FakeResponse(400, {})]))
    with pytest.raises(LLMError):
        await bad.generate_completion("s", "u")

    assert _llm_counter("error") == error_before + 1


async def test_metrics_llm_retries_increment(monkeypatch) -> None:
    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    before = REGISTRY.get_sample_value("llm_retries_total") or 0.0
    client = make_client(
        monkeypatch, FakeHTTPClient(responses=[FakeResponse(500, {}), ok_response()])
    )

    await client.generate_completion("s", "u")

    assert (REGISTRY.get_sample_value("llm_retries_total") or 0.0) == before + 1


async def test_metrics_llm_duration_observed(monkeypatch) -> None:
    labels = {"model": settings.LLM_MODEL}
    count_before = REGISTRY.get_sample_value(
        "llm_request_duration_seconds_count", labels
    )
    sum_before = REGISTRY.get_sample_value("llm_request_duration_seconds_sum", labels)
    assert count_before is not None and sum_before is not None
    client = make_client(monkeypatch, FakeHTTPClient(responses=[ok_response()]))

    await client.generate_completion("s", "u")

    count_after = REGISTRY.get_sample_value(
        "llm_request_duration_seconds_count", labels
    )
    sum_after = REGISTRY.get_sample_value("llm_request_duration_seconds_sum", labels)
    assert count_after is not None and sum_after is not None
    assert count_after == count_before + 1
    assert sum_after > sum_before


async def test_metrics_llm_tokens_record_reported_usage(monkeypatch) -> None:
    response = FakeResponse(
        200,
        {
            "choices": [{"message": {"content": "hello"}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        },
    )
    prompt_before = _tokens("completion", "prompt")
    completion_before = _tokens("completion", "completion")
    total_before = _tokens("completion", "total")

    client = make_client(monkeypatch, FakeHTTPClient(responses=[response]))
    await client.generate_completion("s", "u")

    assert _tokens("completion", "prompt") == prompt_before + 10
    assert _tokens("completion", "completion") == completion_before + 5
    assert _tokens("completion", "total") == total_before + 15


async def test_metrics_llm_tokens_estimated_when_usage_missing(monkeypatch) -> None:
    prompt_before = _tokens("completion", "prompt")
    completion_before = _tokens("completion", "completion")
    total_before = _tokens("completion", "total")

    client = make_client(monkeypatch, FakeHTTPClient(responses=[ok_response("hello")]))
    await client.generate_completion("system prompt", "user prompt")

    # 26 prompt chars // 4 = 6, 5 completion chars ("hello") // 4 = 1.
    assert _tokens("completion", "prompt") == prompt_before + 6
    assert _tokens("completion", "completion") == completion_before + 1
    assert _tokens("completion", "total") == total_before + 7


async def test_metrics_llm_tokens_not_recorded_on_error(monkeypatch) -> None:
    prompt_before = _tokens("completion", "prompt")

    bad = make_client(monkeypatch, FakeHTTPClient(responses=[FakeResponse(400, {})]))
    with pytest.raises(LLMError):
        await bad.generate_completion("s", "u")

    assert _tokens("completion", "prompt") == prompt_before


async def test_metrics_stream_tokens_record_reported_usage(monkeypatch) -> None:
    prompt_before = _tokens("stream", "prompt")
    completion_before = _tokens("stream", "completion")
    total_before = _tokens("stream", "total")

    client = make_client(
        monkeypatch,
        FakeHTTPClient(
            responses=[
                stream_response(
                    ["Hello", " world"],
                    usage={"prompt_tokens": 7, "completion_tokens": 2},
                )
            ]
        ),
    )

    deltas = [delta async for delta in client.generate_stream("s", "u")]
    assert deltas == ["Hello", " world"]

    assert _tokens("stream", "prompt") == prompt_before + 7
    assert _tokens("stream", "completion") == completion_before + 2
    assert _tokens("stream", "total") == total_before + 9


async def test_metrics_stream_tokens_estimated_when_usage_missing(monkeypatch) -> None:
    prompt_before = _tokens("stream", "prompt")
    completion_before = _tokens("stream", "completion")

    client = make_client(
        monkeypatch,
        FakeHTTPClient(responses=[stream_response(["Hello world"])]),
    )

    deltas = [delta async for delta in client.generate_stream("system prompt", "u")]
    assert deltas == ["Hello world"]

    # 13 prompt chars // 4 = 3, 11 completion chars // 4 = 2.
    assert _tokens("stream", "prompt") == prompt_before + 3
    assert _tokens("stream", "completion") == completion_before + 2


async def test_metrics_recommend_record_mode_and_duration(running_server) -> None:
    channel, _ = running_server
    stub = ai_stubs.AIServiceStub(channel)
    target = str(uuid4())
    twin = str(uuid4())
    await stub.IndexPost(_index_request(target, "beta doc"))
    await stub.IndexPost(_index_request(twin, "beta doc"))
    await stub.UpdateUserProfile(
        _profile_update("user-1", target, ai_service_pb2.INTERACTION_KIND_VIEW)
    )
    default_before = _recommend_counter("default", "OK")
    surprise_before = _recommend_counter("surprise", "OK")
    duration_before = _recommend_duration_count("default")

    await stub.RecommendFeed(
        ai_service_pb2.RecommendRequest(
            user_id="user-1", mode=ai_service_pb2.RECOMMEND_MODE_DEFAULT
        )
    )
    await stub.RecommendFeed(
        ai_service_pb2.RecommendRequest(
            user_id="user-1", mode=ai_service_pb2.RECOMMEND_MODE_SURPRISE
        )
    )

    assert _recommend_counter("default", "OK") == default_before + 1
    assert _recommend_counter("surprise", "OK") == surprise_before + 1
    assert _recommend_duration_count("default") == duration_before + 1


async def test_metrics_recommend_cold_start_ratio_and_counter(running_server) -> None:
    channel, _ = running_server
    stub = ai_stubs.AIServiceStub(channel)
    target = str(uuid4())
    twin = str(uuid4())
    await stub.IndexPost(_index_request(target, "beta doc"))
    await stub.IndexPost(_index_request(twin, "beta doc"))
    await stub.UpdateUserProfile(
        _profile_update("user-1", target, ai_service_pb2.INTERACTION_KIND_VIEW)
    )
    cold_before = _cold_start_total()

    await stub.RecommendFeed(ai_service_pb2.RecommendRequest(user_id="cold-user"))
    assert _cold_start_total() == cold_before + 1

    await stub.RecommendFeed(ai_service_pb2.RecommendRequest(user_id="user-1"))
    assert _cold_start_total() == cold_before + 1

    total = sum(
        _recommend_counter(mode, "OK")
        for mode in ("default", "surprise", "fresh", "explorer")
    )
    ratio = REGISTRY.get_sample_value("recommend_cold_start_ratio")
    assert ratio == _cold_start_total() / total


async def test_metrics_profile_updates_record_kind(running_server) -> None:
    channel, _ = running_server
    stub = ai_stubs.AIServiceStub(channel)
    before = {kind: _profile_updates(kind) for kind in ("view", "like", "save")}

    await stub.UpdateUserProfile(
        _profile_update("user-1", str(uuid4()), ai_service_pb2.INTERACTION_KIND_VIEW)
    )
    await stub.UpdateUserProfile(
        _profile_update("user-1", str(uuid4()), ai_service_pb2.INTERACTION_KIND_LIKE)
    )
    await stub.UpdateUserProfile(
        _profile_update("user-1", str(uuid4()), ai_service_pb2.INTERACTION_KIND_SAVE)
    )

    assert _profile_updates("view") == before["view"] + 1
    assert _profile_updates("like") == before["like"] + 1
    assert _profile_updates("save") == before["save"] + 1


async def test_metrics_recommend_counters_not_recorded_on_validation_error(
    running_server,
) -> None:
    channel, _ = running_server
    stub = ai_stubs.AIServiceStub(channel)
    recommend_before = _recommend_counter("default", "OK")
    cold_before = _cold_start_total()
    profile_before = _profile_updates("view")

    with pytest.raises(grpc.aio.AioRpcError):
        await stub.RecommendFeed(ai_service_pb2.RecommendRequest(user_id=""))
    with pytest.raises(grpc.aio.AioRpcError):
        await stub.UpdateUserProfile(
            _profile_update(
                "user-1", str(uuid4()), ai_service_pb2.INTERACTION_KIND_UNSPECIFIED
            )
        )

    assert _recommend_counter("default", "OK") == recommend_before
    assert _cold_start_total() == cold_before
    assert _profile_updates("view") == profile_before


def _qdrant_counter(operation: str, status: str) -> float:
    return (
        REGISTRY.get_sample_value(
            "qdrant_requests_total", {"operation": operation, "status": status}
        )
        or 0.0
    )


def _qdrant_duration_count(operation: str) -> float:
    return (
        REGISTRY.get_sample_value(
            "qdrant_request_duration_seconds_count",
            {"operation": operation, "status": "success"},
        )
        or 0.0
    )


def _dependency_up(dep: str) -> float | None:
    return REGISTRY.get_sample_value("dependency_up", {"dep": dep})


async def test_metrics_qdrant_records_operation_success() -> None:
    client = AsyncQdrantClient(location=":memory:")
    index = SearchIndex(FakeEmbeddingClient(), client)
    try:
        await index.ensure_collection()
        ok_before = _qdrant_counter("upsert", "success")
        duration_before = _qdrant_duration_count("upsert")

        await index.upsert("6a75a41221a9752ec47bc60a", "t", "b", "s", [], "2026-01-01")

        assert _qdrant_counter("upsert", "success") == ok_before + 1
        assert _qdrant_duration_count("upsert") == duration_before + 1
        assert _dependency_up("qdrant") == 1.0
    finally:
        await index.close()


async def test_metrics_qdrant_records_operation_error() -> None:
    from src.vector import _record_qdrant

    @_record_qdrant("search")
    async def failing() -> None:
        raise RuntimeError("store down")

    err_before = _qdrant_counter("search", "error")

    with pytest.raises(RuntimeError):
        await failing()

    assert _qdrant_counter("search", "error") == err_before + 1
    assert _dependency_up("qdrant") == 0.0


async def test_metrics_embedding_records_mode_and_dependency(monkeypatch) -> None:
    from src.embeddings import OllamaEmbeddingClient

    labels = {"status": "success", "mode": "ollama"}
    ok_before = REGISTRY.get_sample_value("embedding_requests_total", labels) or 0.0

    transport_client = OllamaEmbeddingClient(
        httpx.AsyncClient(
            base_url="http://embedding-service:11434",
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200, json={"embeddings": [[0.0] * settings.QDRANT_VECTOR_SIZE]}
                )
            ),
        )
    )
    try:
        await transport_client.embed(["hello"])
    finally:
        await transport_client.close()

    assert (REGISTRY.get_sample_value("embedding_requests_total", labels) or 0.0) == (
        ok_before + 1
    )
    assert _dependency_up("embedding") == 1.0


def _fetch_duration_count(source: str) -> float:
    return (
        REGISTRY.get_sample_value(
            "retrieval_fetch_duration_seconds_count", {"source": source}
        )
        or 0.0
    )


def _fetch_errors(source: str) -> float:
    return (
        REGISTRY.get_sample_value("retrieval_fetch_errors_total", {"source": source})
        or 0.0
    )


async def test_metrics_retrieval_sources_record_fetch() -> None:
    client = AsyncQdrantClient(location=":memory:")
    index = SearchIndex(FakeEmbeddingClient(), client)
    try:
        await index.ensure_collection()
        dense = DenseSource(index, FakeEmbeddingClient())
        hybrid = HybridSource(index)
        dense_before = _fetch_duration_count("dense")
        hybrid_before = _fetch_duration_count("hybrid")

        assert await dense.fetch("hello", 3) == []
        assert await hybrid.fetch("hello", 3) == []

        assert _fetch_duration_count("dense") == dense_before + 1
        assert _fetch_duration_count("hybrid") == hybrid_before + 1
        assert _fetch_errors("dense") == 0.0
    finally:
        await index.close()


async def test_metrics_retrieval_source_records_error() -> None:
    class BrokenSearch:
        async def retrieve_by_vector(self, vector, top_k):
            raise RuntimeError("store down")

    dense = DenseSource(BrokenSearch(), FakeEmbeddingClient())  # type: ignore[arg-type]
    err_before = _fetch_errors("dense")

    with pytest.raises(RuntimeError):
        await dense.fetch("hello", 3)

    assert _fetch_errors("dense") == err_before + 1


def _judge_verdicts(verdict: str) -> float:
    return (
        REGISTRY.get_sample_value("chat_judge_verdicts_total", {"verdict": verdict})
        or 0.0
    )


async def test_metrics_judge_records_verdicts() -> None:
    from src.graphs.nodes import make_judge_relevance

    state = {"query": "q", "retrieved": []}
    relevant_before = _judge_verdicts("relevant")
    unavailable_before = _judge_verdicts("unavailable")

    judge = make_judge_relevance(FakeLLM(response='{"relevant": true, "score": 0.9}'))
    await judge(state)
    assert _judge_verdicts("relevant") == relevant_before + 1

    judge = make_judge_relevance(FakeLLM(response="not json at all"))
    await judge(state)
    assert _judge_verdicts("unavailable") == unavailable_before + 1

    irrelevant_before = _judge_verdicts("irrelevant")
    judge = make_judge_relevance(FakeLLM(response='{"relevant": false, "score": 0.1}'))
    out = await judge(state)
    assert _judge_verdicts("irrelevant") == irrelevant_before + 1
    assert out["judge"].relevant is False
