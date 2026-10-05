"""Single-turn content generation use-cases.

Summary, tags, and full-post handlers share one shape: validate the
input size, ask the LLM, and parse the reply into the proto response.
State: self._llm (provided by AIService).
"""

import json
import logging
import re

import grpc
from pydantic import ValidationError

from src.application.support import TooLargeError, rpc_metrics
from src.config import settings
from src.domain.models import GeneratedPost
from src.domain.prompts import (
    POST_PROMPT,
    SUMMARY_PROMPT,
    TAGS_PROMPT,
    post_user_prompt,
    styled_post_user_prompt,
)
from src.domain.sanitize import sanitize_post_html
from src.domain.text import clean_html, extract_json
from src.domain.verify import (
    MAX_POST_ATTEMPTS,
    repair_user_prompt,
    soft_check_post,
    spec_for_length,
    verify_post,
)
from src.generated import ai_service_pb2
from src.observability import metrics

logger = logging.getLogger(__name__)


def _enum_name(enum_type, value: int) -> str:
    """Proto enum value to its bare selector (e.g. 5 -> "WITTY").

    Unknown values yield "" so prompt builders fall back to defaults.
    """
    try:
        full_name = enum_type.Name(value)
    except ValueError:
        return ""
    prefix = re.sub(r"(?<!^)(?=[A-Z])", "_", enum_type.DESCRIPTOR.name).upper() + "_"
    return full_name.removeprefix(prefix)


def _has_brief(request: ai_service_pb2.PostGenerationRequest) -> bool:
    """Whether the caller filled any writing-brief field."""
    return bool(
        request.audience
        or request.tone
        or request.length
        or request.structure
        or request.keywords.strip()
        or request.key_points.strip()
    )


class GenerationMixin:
    """GenerateSummary / GenerateTags / GeneratePost handlers."""

    @rpc_metrics("/ai.AIService/GenerateSummary")
    async def GenerateSummary(
        self, request: ai_service_pb2.ContentRequest, context: grpc.aio.ServicerContext
    ) -> ai_service_pb2.ContentResponse:
        if len(request.text) > settings.MAX_INPUT_CHARS:
            raise TooLargeError(settings.MAX_INPUT_CHARS)

        text = clean_html(request.text).strip()
        if not text:
            return ai_service_pb2.ContentResponse(summary="")

        summary = await self._llm.generate_completion(SUMMARY_PROMPT, text)
        return ai_service_pb2.ContentResponse(summary=summary)

    @rpc_metrics("/ai.AIService/GenerateTags")
    async def GenerateTags(
        self, request: ai_service_pb2.ContextRequest, context: grpc.aio.ServicerContext
    ) -> ai_service_pb2.TagsResponse:
        if len(request.body) > settings.MAX_INPUT_CHARS:
            raise TooLargeError(settings.MAX_INPUT_CHARS)

        content = (
            f"Title: {request.title[: settings.MAX_TITLE_CHARS]}\nBody: "
            f"{clean_html(request.body).strip()[: settings.MAX_BODY_CHARS]}"
        )

        raw = await self._llm.generate_completion(TAGS_PROMPT, content)
        parsed = json.loads(extract_json(raw))
        tags = parsed.get("tags") if isinstance(parsed, dict) else parsed
        if not isinstance(tags, list):
            raise TypeError("LLM response tags are not a list")
        return ai_service_pb2.TagsResponse(tags=[t for t in tags if isinstance(t, str)])

    @rpc_metrics("/ai.AIService/GeneratePost")
    async def GeneratePost(
        self,
        request: ai_service_pb2.PostGenerationRequest,
        context: grpc.aio.ServicerContext,
    ) -> ai_service_pb2.PostGenerationResponse:
        if len(request.prompt) > settings.MAX_POST_CHARS:
            raise TooLargeError(settings.MAX_POST_CHARS)
        if len(request.keywords) > settings.MAX_KEYWORDS_CHARS:
            raise TooLargeError(settings.MAX_KEYWORDS_CHARS)
        if len(request.key_points) > settings.MAX_KEY_POINTS_CHARS:
            raise TooLargeError(settings.MAX_KEY_POINTS_CHARS)

        if _has_brief(request):
            user_prompt = styled_post_user_prompt(
                request.prompt,
                audience=_enum_name(ai_service_pb2.WritingAudience, request.audience),
                tone=_enum_name(ai_service_pb2.WritingTone, request.tone),
                length=_enum_name(ai_service_pb2.WritingLength, request.length),
                structure=_enum_name(
                    ai_service_pb2.WritingStructure, request.structure
                ),
                keywords=request.keywords,
                key_points=request.key_points,
            )
        else:
            user_prompt = post_user_prompt(request.prompt)
        spec = spec_for_length(_enum_name(ai_service_pb2.WritingLength, request.length))
        raw = await self._llm.generate_completion(POST_PROMPT, user_prompt)
        post: GeneratedPost | None = None
        last_error: ValidationError | None = None
        for attempt in range(1, MAX_POST_ATTEMPTS + 1):
            try:
                candidate = GeneratedPost.model_validate_json(extract_json(raw))
            except ValidationError as exc:
                last_error = exc
                issues = [f"unparseable post JSON ({exc.error_count()} errors)"]
            else:
                last_error = None
                candidate.body = sanitize_post_html(candidate.body)
                issues = verify_post(
                    candidate.title,
                    candidate.body,
                    candidate.summary,
                    candidate.tags,
                    spec,
                )
                for note in soft_check_post(
                    candidate.title, candidate.summary, candidate.tags
                ):
                    logger.warning("generated post cosmetic gap: %s", note)
                if not issues:
                    post = candidate
                    metrics.POST_GENERATION_VERIFICATIONS.labels(
                        outcome="first-pass" if attempt == 1 else "repaired"
                    ).inc()
                    break
                post = candidate
            logger.warning(
                "generated post failed verification (attempt %s/%s): %s",
                attempt,
                MAX_POST_ATTEMPTS,
                "; ".join(issues),
            )
            if attempt < MAX_POST_ATTEMPTS:
                raw = await self._llm.generate_completion(
                    POST_PROMPT, repair_user_prompt(user_prompt, spec, issues)
                )
        if post is None:
            assert last_error is not None  # unparseable on every attempt
            raise last_error
        if verify_post(post.title, post.body, post.summary, post.tags, spec):
            metrics.POST_GENERATION_VERIFICATIONS.labels(outcome="best-effort").inc()
        return ai_service_pb2.PostGenerationResponse(
            title=post.title,
            body=post.body,
            summary=post.summary,
            tags=post.tags,
        )
