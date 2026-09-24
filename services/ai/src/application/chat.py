"""Grounded chat use-case: streams answers from the chat graphs.

The sessioned graph resumes by thread id; stateless runs use the
caller's history. State: self._chat_graphs (provided by AIService).
"""

from collections.abc import AsyncIterator
from typing import Any

import grpc

from src.application.support import (
    TooLargeError,
    ValidationError,
    access_logger,
    rpc_stream_metrics,
)
from src.config import settings
from src.generated import ai_service_pb2
from src.graphs.chat_graph import graphs_for_request
from src.graphs.state import ChatMessage
from src.llm import estimate_tokens


class ChatMixin:
    """ChatAnswer handler."""

    @rpc_stream_metrics("/ai.AIService/ChatAnswer")
    async def ChatAnswer(
        self,
        request: ai_service_pb2.ChatAnswerRequest,
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[ai_service_pb2.ChatChunk]:
        """Run the grounded chat graph and stream its answer deltas.

        The graph rewrites, retrieves with judging, optionally calls
        tools, and generates the answer; answer-node deltas stream out of
        langgraph's custom channel. A thread id resumes the checkpointed
        session; without one the stateless variant runs and the caller's
        history seeds the conversation. The final chunk carries the post
        ids the model actually cited.
        """
        if self._chat_graphs is None:
            raise RuntimeError("chat graphs are not configured")

        query = request.query.strip()
        if not query:
            raise ValidationError("query must be a non-empty string")
        if len(query) > settings.SEARCH_MAX_QUERY_CHARS:
            raise ValidationError(
                f"query length must be <= {settings.SEARCH_MAX_QUERY_CHARS} characters"
            )
        top_k = request.top_k or settings.CHAT_TOP_K_DEFAULT
        if top_k > settings.CHAT_MAX_TOP_K:
            raise ValidationError(f"top_k must be <= {settings.CHAT_MAX_TOP_K}")

        inputs: dict[str, Any] = {"query": query, "top_k": top_k}
        if request.thread_id:
            # The checkpoint holds this session's turns.
            graph, config = graphs_for_request(self._chat_graphs, request.thread_id)
        else:
            graph, config = (
                self._chat_graphs.stateless,
                None,
            )
            history: list[ChatMessage] = []
            for message in request.history:
                role = message.role.strip()
                if role not in ("user", "assistant"):
                    raise ValidationError(f"unsupported history role: {role!r}")
                if len(message.content) > settings.MAX_INPUT_CHARS:
                    raise TooLargeError(settings.MAX_INPUT_CHARS)
                if message.content.strip():
                    history.append(
                        ChatMessage(role=role, content=message.content.strip())
                    )
            inputs["messages"] = history[-settings.CHAT_MAX_HISTORY_TURNS :]

        cited: list[str] = []
        completion_chars = 0
        async for payload in graph.astream(inputs, config=config, stream_mode="custom"):
            if isinstance(payload, str):
                completion_chars += len(payload)
                yield ai_service_pb2.ChatChunk(delta=payload)
            elif isinstance(payload, dict):
                cited = payload.get("cited_post_ids", [])

        access_logger.info(
            "chat completed",
            extra={
                "completion_tokens_est": estimate_tokens("x" * completion_chars),
                "cited_posts": len(cited),
                "thread_id": request.thread_id,
            },
        )
        yield ai_service_pb2.ChatChunk(done=True, cited_post_ids=cited)
