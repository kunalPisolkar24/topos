"""Interest-profile and personalized-feed use-cases.

UpdateUserProfile folds one interaction into the stored taste profile;
RecommendFeed ranks posts through the deterministic blend engine, the
feed agent, or the surprise path. State: self._search and
self._feed_agent (provided by AIService).
"""

import time
from typing import Any

import grpc

from src.application.support import ValidationError, _record_recommend, rpc_metrics
from src.config import settings
from src.domain.reasons import build_reasons
from src.generated import ai_service_pb2
from src.graphs.feed_graph import EXPLORER, FRESH, execute_blend
from src.observability import metrics


def _interaction_weight(kind: int) -> float | None:
    """Map an InteractionKind enum value to its profile fold weight.

    Unspecified or unknown kinds yield None so handlers can reject them.
    The weights mirror the content service's fixed view/like/save values
    and stay configurable via settings.
    """
    return {
        ai_service_pb2.INTERACTION_KIND_VIEW: settings.PROFILE_VIEW_WEIGHT,
        ai_service_pb2.INTERACTION_KIND_LIKE: settings.PROFILE_LIKE_WEIGHT,
        ai_service_pb2.INTERACTION_KIND_SAVE: settings.PROFILE_SAVE_WEIGHT,
    }.get(kind)


def _mode_name(mode: int) -> str:
    """Map a RecommendMode enum value to its metric and log label.

    UNSPECIFIED requests are served as default-mode feeds, so they share
    the default label.
    """
    return {
        ai_service_pb2.RECOMMEND_MODE_UNSPECIFIED: "default",
        ai_service_pb2.RECOMMEND_MODE_DEFAULT: "default",
        ai_service_pb2.RECOMMEND_MODE_SURPRISE: "surprise",
        ai_service_pb2.RECOMMEND_MODE_FRESH: "fresh",
        ai_service_pb2.RECOMMEND_MODE_EXPLORER: "explorer",
    }[mode]


def _preset_for_mode(mode: int) -> str | None:
    """The blend preset a mode maps to, when it names one explicitly.

    FRESH and EXPLORER are first-class modes served by the deterministic
    engine with preset knobs; DEFAULT/UNSPECIFIED/SURPRISE return None
    so they keep their dedicated paths (or the agent's pick).
    """
    if mode == ai_service_pb2.RECOMMEND_MODE_FRESH:
        return FRESH
    if mode == ai_service_pb2.RECOMMEND_MODE_EXPLORER:
        return EXPLORER
    return None


def _kind_name(kind: int) -> str:
    """Map an InteractionKind enum value to its metric and log label."""
    return {
        ai_service_pb2.INTERACTION_KIND_VIEW: "view",
        ai_service_pb2.INTERACTION_KIND_LIKE: "like",
        ai_service_pb2.INTERACTION_KIND_SAVE: "save",
    }[kind]


def _recommend_access_fields(
    request: ai_service_pb2.RecommendRequest,
    response: ai_service_pb2.RecommendResponse,
) -> dict[str, Any]:
    """Extra access-log fields describing a completed RecommendFeed call."""
    return {
        "mode": _mode_name(request.mode),
        "result_count": len(response.post_ids),
        "total": response.total,
    }


def _profile_access_fields(
    request: ai_service_pb2.UserProfileUpdateRequest,
    response: ai_service_pb2.UserProfileUpdateResponse,
) -> dict[str, Any]:
    """Extra access-log fields describing a completed UpdateUserProfile call."""
    return {"kind": _kind_name(request.kind)}


class ProfilesMixin:
    """UpdateUserProfile / RecommendFeed handlers."""

    @rpc_metrics("/ai.AIService/UpdateUserProfile", extra_fields=_profile_access_fields)
    async def UpdateUserProfile(
        self,
        request: ai_service_pb2.UserProfileUpdateRequest,
        context: grpc.aio.ServicerContext,
    ) -> ai_service_pb2.UserProfileUpdateResponse:
        user_id = request.user_id.strip()
        if not user_id:
            raise ValidationError("user_id must be a non-empty string")
        if len(user_id) > settings.PROFILE_MAX_ID_CHARS:
            raise ValidationError(
                f"user_id length must be <= {settings.PROFILE_MAX_ID_CHARS} characters"
            )
        post_id = request.post_id.strip()
        if not post_id:
            raise ValidationError("post_id must be a non-empty string")
        weight = _interaction_weight(request.kind)
        if weight is None:
            raise ValidationError(f"unsupported interaction kind: {request.kind}")
        if request.source_mode not in (
            ai_service_pb2.RECOMMEND_MODE_UNSPECIFIED,
            ai_service_pb2.RECOMMEND_MODE_DEFAULT,
            ai_service_pb2.RECOMMEND_MODE_SURPRISE,
        ):
            raise ValidationError(f"unsupported source mode: {request.source_mode}")

        if request.source_mode == ai_service_pb2.RECOMMEND_MODE_SURPRISE:
            weight *= settings.PROFILE_SURPRISE_FEEDBACK_MULTIPLIER
            metrics.SURPRISE_INTERACTIONS.labels(kind=_kind_name(request.kind)).inc()

        await self._search.update_user_profile(user_id, post_id, weight)
        metrics.PROFILE_UPDATES.labels(kind=_kind_name(request.kind)).inc()
        return ai_service_pb2.UserProfileUpdateResponse()

    @rpc_metrics("/ai.AIService/RecommendFeed", extra_fields=_recommend_access_fields)
    async def RecommendFeed(
        self,
        request: ai_service_pb2.RecommendRequest,
        context: grpc.aio.ServicerContext,
    ) -> ai_service_pb2.RecommendResponse:
        user_id = request.user_id.strip()
        if not user_id:
            raise ValidationError("user_id must be a non-empty string")
        if len(user_id) > settings.PROFILE_MAX_ID_CHARS:
            raise ValidationError(
                f"user_id length must be <= {settings.PROFILE_MAX_ID_CHARS} characters"
            )
        if request.mode not in (
            ai_service_pb2.RECOMMEND_MODE_UNSPECIFIED,
            ai_service_pb2.RECOMMEND_MODE_DEFAULT,
            ai_service_pb2.RECOMMEND_MODE_SURPRISE,
            ai_service_pb2.RECOMMEND_MODE_FRESH,
            ai_service_pb2.RECOMMEND_MODE_EXPLORER,
        ):
            raise ValidationError(f"unsupported recommend mode: {request.mode}")
        limit = request.limit or 10
        if limit > settings.SEARCH_MAX_LIMIT:
            raise ValidationError(f"limit must be <= {settings.SEARCH_MAX_LIMIT}")
        if request.offset + limit > settings.SEARCH_MAX_RESULT_WINDOW:
            raise ValidationError(
                f"pagination window exceeds {settings.SEARCH_MAX_RESULT_WINDOW}"
            )

        mode = _mode_name(request.mode)
        start = time.perf_counter()
        preset = _preset_for_mode(request.mode)
        if preset is not None:
            result = await execute_blend(
                self._search, user_id, request.offset, limit, preset, request.seed
            )
        elif self._feed_agent is not None and request.mode != (
            ai_service_pb2.RECOMMEND_MODE_SURPRISE
        ):
            preset = await self._feed_agent.decide(user_id)
            result = await execute_blend(
                self._search, user_id, request.offset, limit, preset, request.seed
            )
        elif request.mode == ai_service_pb2.RECOMMEND_MODE_SURPRISE:
            result = await self._search.recommend_surprise(
                user_id, request.offset, limit, request.seed
            )
        else:
            result = await self._search.recommend(user_id, request.offset, limit)
        _record_recommend(
            mode, time.perf_counter() - start, cold_start=result.total == 0
        )
        return ai_service_pb2.RecommendResponse(
            post_ids=result.post_ids,
            total=result.total,
            reasons=await self._recommendation_reasons(
                user_id,
                result.post_ids,
                surprise=request.mode == ai_service_pb2.RECOMMEND_MODE_SURPRISE,
            ),
        )

    async def _recommendation_reasons(
        self, user_id: str, post_ids: list[str], surprise: bool
    ) -> dict[str, str]:
        """Evidence lines for a feed page; empty for surprise feeds.

        Surprise posts are deliberately off-taste, so taste-based
        evidence would be misleading there.
        """
        if surprise or not post_ids:
            return {}
        tag_weights = await self._search.user_tag_weights(user_id)
        if not tag_weights:
            return {}
        return build_reasons(tag_weights, await self._search.post_tags(post_ids))
