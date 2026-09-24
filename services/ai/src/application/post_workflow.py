"""Review-gated post generation workflow use-cases.

Draft, approve, and reject handlers resume a checkpointed LangGraph
thread by approval id. State: self._post_generation_graph (AIService).
"""

import uuid
from typing import Any

import grpc

from src.application.support import (
    NotFoundError,
    TooLargeError,
    ValidationError,
    rpc_metrics,
)
from src.config import settings
from src.generated import ai_service_pb2
from src.graphs.post_graph import (
    STATUS_APPROVED,
    STATUS_PENDING,
    STATUS_REJECTED,
    draft_edits_patch,
    post_graph_config_for,
    resume_with_decision,
)

_STATUS_TO_PROTO = {
    STATUS_PENDING: ai_service_pb2.WORKFLOW_STATUS_PENDING,
    STATUS_APPROVED: ai_service_pb2.WORKFLOW_STATUS_APPROVED,
    STATUS_REJECTED: ai_service_pb2.WORKFLOW_STATUS_REJECTED,
}


class PostWorkflowMixin:
    """GeneratePostDraft / ApprovePost / RejectPost handlers."""

    def _workflow_state_pb(
        self, values: dict[str, Any], approval_id: str
    ) -> ai_service_pb2.PostWorkflowState:
        status = _STATUS_TO_PROTO.get(values.get("status", ""), 0)
        return ai_service_pb2.PostWorkflowState(
            title=values.get("title", ""),
            body=values.get("body", ""),
            summary=values.get("summary", ""),
            tags=list(values.get("tags", [])),
            approval_id=approval_id,
            status=status,
        )

    async def _draft_state(self, approval_id: str) -> dict[str, Any]:
        """Checkpointed values of one draft workflow; empty when unknown."""
        config = post_graph_config_for(approval_id)
        snapshot = await self._post_generation_graph.aget_state(config)
        return dict(snapshot.values or {})

    @rpc_metrics("/ai.AIService/GeneratePostDraft")
    async def GeneratePostDraft(
        self,
        request: ai_service_pb2.PostGenerationRequest,
        context: grpc.aio.ServicerContext,
    ) -> ai_service_pb2.PostWorkflowState:
        """Generate a draft and pause the workflow at the review gate.

        The returned approval_id names the checkpointed thread; nothing
        is published until ApprovePost resumes it.
        """
        if self._post_generation_graph is None:
            raise RuntimeError("post generation graph is not configured")

        prompt = request.prompt.strip()
        if not prompt:
            raise ValidationError("prompt must be a non-empty string")
        if len(prompt) > settings.MAX_POST_CHARS:
            raise TooLargeError(settings.MAX_POST_CHARS)

        approval_id = uuid.uuid4().hex
        result = await self._post_generation_graph.ainvoke(
            {"prompt": prompt}, config=post_graph_config_for(approval_id)
        )
        return self._workflow_state_pb(result, approval_id)

    @rpc_metrics("/ai.AIService/ApprovePost")
    async def ApprovePost(
        self,
        request: ai_service_pb2.ApprovePostRequest,
        context: grpc.aio.ServicerContext,
    ) -> ai_service_pb2.PostWorkflowState:
        """Resume an approved draft; optional edits land before the resume.

        Idempotent: approving an already-approved workflow returns its
        stored payload without re-running anything.
        """
        if self._post_generation_graph is None:
            raise RuntimeError("post generation graph is not configured")

        if not request.approval_id:
            raise ValidationError("approval_id must be a non-empty string")

        values = await self._draft_state(request.approval_id)
        if not values.get("title"):
            raise NotFoundError(f"unknown approval_id: {request.approval_id}")
        if values.get("status") == STATUS_APPROVED:
            return self._workflow_state_pb(values, request.approval_id)

        edits = draft_edits_patch(
            title=request.title if request.HasField("title") else None,
            body=request.body if request.HasField("body") else None,
            summary=request.summary if request.HasField("summary") else None,
            tags=list(request.tags) or None,
        )
        result = await resume_with_decision(
            self._post_generation_graph,
            post_graph_config_for(request.approval_id),
            "approved",
            edits=edits,
        )
        return self._workflow_state_pb(result, request.approval_id)

    @rpc_metrics("/ai.AIService/RejectPost")
    async def RejectPost(
        self,
        request: ai_service_pb2.RejectPostRequest,
        context: grpc.aio.ServicerContext,
    ) -> ai_service_pb2.PostWorkflowState:
        """Record a rejection while keeping the workflow resumable.

        The state update leaves the thread paused at the review gate, so
        a later ApprovePost can still publish it. Idempotent for repeats.
        """
        if self._post_generation_graph is None:
            raise RuntimeError("post generation graph is not configured")

        if not request.approval_id:
            raise ValidationError("approval_id must be a non-empty string")

        values = await self._draft_state(request.approval_id)
        if not values.get("title"):
            raise NotFoundError(f"unknown approval_id: {request.approval_id}")
        if values.get("status") == STATUS_REJECTED:
            return self._workflow_state_pb(values, request.approval_id)

        updates: dict[str, Any] = {"status": STATUS_REJECTED}
        if request.reason.strip():
            updates["reason"] = request.reason
        await self._post_generation_graph.aupdate_state(
            post_graph_config_for(request.approval_id), updates
        )
        values.update(updates)
        return self._workflow_state_pb(values, request.approval_id)
