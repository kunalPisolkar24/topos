import grpc
import logging
import asyncio
from src.generated import ai_service_pb2, ai_service_pb2_grpc
from src.usecases.content_logic import ContentLogic
from src.core.exceptions import LLMProviderError, RateLimitError, DataParsingError
from src.config.settings import settings

_MAX_TEXT_LENGTH = 100_000
_MAX_TITLE_LENGTH = 500
_MAX_BODY_LENGTH = 100_000
_MAX_TAGS_BODY_LENGTH = 3_000
_MAX_PROMPT_LENGTH = 5_000
_HANDLER_TIMEOUT_SECONDS = settings.LLM_HANDLER_TIMEOUT

class AIHandler(ai_service_pb2_grpc.AIServiceServicer):
    def __init__(self, logic: ContentLogic):
        self.logic = logic
        self.logger = logging.getLogger(__name__)

    async def GenerateSummary(self, request, context):
        if len(request.text) > _MAX_TEXT_LENGTH:
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, f"Text exceeds maximum length of {_MAX_TEXT_LENGTH}")
        try:
            summary = await asyncio.wait_for(
                self.logic.generate_summary(request.text),
                timeout=_HANDLER_TIMEOUT_SECONDS
            )
            return ai_service_pb2.ContentResponse(summary=summary)
        except asyncio.CancelledError:
            self.logger.warning("GenerateSummary request cancelled by client")
            await context.abort(grpc.StatusCode.CANCELLED, "Request cancelled")
        except TimeoutError:
            self.logger.warning("GenerateSummary timed out")
            await context.abort(grpc.StatusCode.DEADLINE_EXCEEDED, "Request timed out")
        except RateLimitError as e:
            self.logger.warning("Summary generation rate limited", extra={"retry_after": e.retry_after})
            await context.abort(grpc.StatusCode.RESOURCE_EXHAUSTED, "AI provider rate limit exceeded")
        except LLMProviderError as e:
            self.logger.error(f"Summary generation LLM error: {e}")
            await context.abort(grpc.StatusCode.UNAVAILABLE, str(e))
        except Exception as e:
            self.logger.exception("Summary generation failed")
            await context.abort(grpc.StatusCode.INTERNAL, "Internal service error")

    async def GenerateTags(self, request, context):
        if len(request.title) > _MAX_TITLE_LENGTH:
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, f"Title exceeds maximum length of {_MAX_TITLE_LENGTH}")
        if len(request.body) > _MAX_BODY_LENGTH:
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, f"Body exceeds maximum length of {_MAX_BODY_LENGTH}")
        body = request.body[:_MAX_TAGS_BODY_LENGTH]
        if len(request.body) > _MAX_TAGS_BODY_LENGTH:
            self.logger.warning("Body truncated for tag generation", "original_length", len(request.body))
        try:
            tags = await asyncio.wait_for(
                self.logic.generate_tags(request.title, body),
                timeout=_HANDLER_TIMEOUT_SECONDS
            )
            return ai_service_pb2.TagsResponse(tags=tags)
        except asyncio.CancelledError:
            self.logger.warning("GenerateTags request cancelled by client")
            await context.abort(grpc.StatusCode.CANCELLED, "Request cancelled")
        except TimeoutError:
            self.logger.warning("GenerateTags timed out")
            await context.abort(grpc.StatusCode.DEADLINE_EXCEEDED, "Request timed out")
        except DataParsingError as e:
            self.logger.warning(f"Tags parsing error: {e}")
            await context.abort(grpc.StatusCode.DATA_LOSS, str(e))
        except RateLimitError as e:
            self.logger.warning("Tags generation rate limited", extra={"retry_after": e.retry_after})
            await context.abort(grpc.StatusCode.RESOURCE_EXHAUSTED, "AI provider rate limit exceeded")
        except LLMProviderError as e:
            self.logger.error(f"Tags generation LLM error: {e}")
            await context.abort(grpc.StatusCode.UNAVAILABLE, str(e))
        except Exception as e:
            self.logger.exception("Tag generation failed")
            await context.abort(grpc.StatusCode.INTERNAL, "Internal service error")

    async def GeneratePost(self, request, context):
        if len(request.prompt) > _MAX_PROMPT_LENGTH:
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, f"Prompt exceeds maximum length of {_MAX_PROMPT_LENGTH}")
        try:
            post = await asyncio.wait_for(
                self.logic.generate_post(request.prompt),
                timeout=_HANDLER_TIMEOUT_SECONDS
            )
            return ai_service_pb2.PostGenerationResponse(
                title=post.title,
                body=post.body,
                summary=post.summary,
                tags=post.tags
            )
        except asyncio.CancelledError:
            self.logger.warning("GeneratePost request cancelled by client")
            await context.abort(grpc.StatusCode.CANCELLED, "Request cancelled")
        except TimeoutError:
            self.logger.warning("GeneratePost timed out")
            await context.abort(grpc.StatusCode.DEADLINE_EXCEEDED, "Request timed out")
        except DataParsingError as e:
            self.logger.warning(f"Post parsing error: {e}")
            await context.abort(grpc.StatusCode.DATA_LOSS, str(e))
        except RateLimitError as e:
            self.logger.warning("Post generation rate limited", extra={"retry_after": e.retry_after})
            await context.abort(grpc.StatusCode.RESOURCE_EXHAUSTED, "AI provider rate limit exceeded")
        except LLMProviderError as e:
            self.logger.error(f"Post generation LLM error: {e}")
            await context.abort(grpc.StatusCode.UNAVAILABLE, str(e))
        except Exception as e:
            self.logger.exception("Post generation failed")
            await context.abort(grpc.StatusCode.INTERNAL, "Internal service error")