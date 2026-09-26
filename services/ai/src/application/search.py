"""Vector-store use-cases: indexing, search, and raw embedding access.

Index/search/related handlers delegate to the search store; Embed
exposes the client-side provider directly. State: self._search and
self._embeddings (provided by AIService).
"""

import asyncio

import grpc

from src.application.support import ValidationError, rpc_metrics
from src.config import settings
from src.generated import ai_service_pb2


class SearchMixin:
    """IndexPost / DeletePost / SearchPosts / RelatedPosts(Batch) / Embed."""

    @rpc_metrics("/ai.AIService/IndexPost")
    async def IndexPost(
        self, request: ai_service_pb2.IndexRequest, context: grpc.aio.ServicerContext
    ) -> ai_service_pb2.IndexResponse:
        if not request.post_id:
            raise ValidationError("post_id must be a non-empty string")
        # Bodies can be far larger than the embedding budget (content
        # allows ~1 MiB); truncate to the budget instead of rejecting so
        # long posts still index their head instead of landing in the DLQ.
        body = request.body[: settings.EMBEDDING_MAX_CHARS]

        created_at = ""
        if request.HasField("created_at"):
            created_at = request.created_at.ToDatetime().strftime("%Y-%m-%dT%H:%M:%SZ")

        await self._search.upsert(
            post_id=request.post_id,
            title=request.title,
            body=body,
            summary=request.summary,
            tags=list(request.tags),
            created_at=created_at,
        )
        return ai_service_pb2.IndexResponse()

    @rpc_metrics("/ai.AIService/DeletePost")
    async def DeletePost(
        self, request: ai_service_pb2.DeleteRequest, context: grpc.aio.ServicerContext
    ) -> ai_service_pb2.DeleteResponse:
        if not request.post_id:
            raise ValidationError("post_id must be a non-empty string")

        await self._search.delete(request.post_id)
        return ai_service_pb2.DeleteResponse()

    @rpc_metrics("/ai.AIService/SearchPosts")
    async def SearchPosts(
        self, request: ai_service_pb2.SearchRequest, context: grpc.aio.ServicerContext
    ) -> ai_service_pb2.SearchResponse:
        query = request.query.strip()
        if not query:
            raise ValidationError("query must be a non-empty string")
        if len(query) > settings.SEARCH_MAX_QUERY_CHARS:
            raise ValidationError(
                f"query length must be <= {settings.SEARCH_MAX_QUERY_CHARS} characters"
            )
        limit = request.limit or 10
        if limit > settings.SEARCH_MAX_LIMIT:
            raise ValidationError(f"limit must be <= {settings.SEARCH_MAX_LIMIT}")
        if request.offset + limit > settings.SEARCH_MAX_RESULT_WINDOW:
            raise ValidationError(
                f"pagination window exceeds {settings.SEARCH_MAX_RESULT_WINDOW}"
            )

        result = await self._search.search(query, request.offset, limit)
        return ai_service_pb2.SearchResponse(
            post_ids=result.post_ids, total=result.total
        )

    @rpc_metrics("/ai.AIService/RelatedPosts")
    async def RelatedPosts(
        self, request: ai_service_pb2.RelatedRequest, context: grpc.aio.ServicerContext
    ) -> ai_service_pb2.RelatedResponse:
        if not request.post_id:
            raise ValidationError("post_id must be a non-empty string")
        limit = request.limit or settings.RELATED_DEFAULT_LIMIT
        if limit > settings.SEARCH_MAX_LIMIT:
            raise ValidationError(f"limit must be <= {settings.SEARCH_MAX_LIMIT}")

        post_ids = await self._search.related(request.post_id, limit)
        total = await self._search.count()
        return ai_service_pb2.RelatedResponse(post_ids=post_ids, total=total)

    @rpc_metrics("/ai.AIService/RelatedPostsBatch")
    async def RelatedPostsBatch(
        self,
        request: ai_service_pb2.RelatedBatchRequest,
        context: grpc.aio.ServicerContext,
    ) -> ai_service_pb2.RelatedBatchResponse:
        if not request.post_ids:
            raise ValidationError("post_ids must not be empty")
        limit = request.limit or settings.RELATED_DEFAULT_LIMIT
        if limit > settings.SEARCH_MAX_LIMIT:
            raise ValidationError(f"limit must be <= {settings.SEARCH_MAX_LIMIT}")

        post_ids = [post_id for post_id in dict.fromkeys(request.post_ids)]
        if any(not post_id for post_id in post_ids):
            raise ValidationError("post_ids must not contain empty strings")

        results = await asyncio.gather(
            *(self._search.related(post_id, limit) for post_id in post_ids)
        )
        total = await self._search.count()
        return ai_service_pb2.RelatedBatchResponse(
            results=[
                ai_service_pb2.RelatedBatchItem(
                    post_id=post_id,
                    related_post_ids=post_ids_for,
                    total=total,
                )
                for post_id, post_ids_for in zip(post_ids, results)
            ]
        )

    @rpc_metrics("/ai.AIService/Embed")
    async def Embed(
        self, request: ai_service_pb2.EmbedRequest, context: grpc.aio.ServicerContext
    ) -> ai_service_pb2.EmbedResponse:
        if settings.EMBEDDING_MODE == "inference":
            await context.abort(
                grpc.StatusCode.UNIMPLEMENTED,
                "Embed is unavailable in inference mode: Qdrant embeds server-side",
            )
        text = request.text.strip()
        if not text:
            raise ValidationError("text must be a non-empty string")
        if len(text) > settings.SEARCH_MAX_QUERY_CHARS:
            raise ValidationError(
                f"text length must be <= {settings.SEARCH_MAX_QUERY_CHARS} characters"
            )

        vector = await self._embed(text)
        return ai_service_pb2.EmbedResponse(vector=vector)

    async def _embed(self, text: str) -> list[float]:
        """Embed a single text through the provider backing the Embed RPC."""
        return (await self._embeddings.embed([text]))[0]
