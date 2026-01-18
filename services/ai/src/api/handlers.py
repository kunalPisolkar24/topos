import grpc
import logging
from src.generated import ai_service_pb2, ai_service_pb2_grpc
from src.usecases.content_logic import ContentLogic
from src.core.exceptions import LLMProviderError, DataParsingError

class AIHandler(ai_service_pb2_grpc.AIServiceServicer):
    def __init__(self, logic: ContentLogic):
        self.logic = logic
        self.logger = logging.getLogger(__name__)

    async def GenerateSummary(self, request, context):
        try:
            summary = await self.logic.generate_summary(request.text)
            return ai_service_pb2.ContentResponse(summary=summary)
        except LLMProviderError as e:
            self.logger.error(f"Summary generation LLM error: {e}")
            await context.abort(grpc.StatusCode.UNAVAILABLE, str(e))
        except Exception as e:
            self.logger.exception("Summary generation failed")
            await context.abort(grpc.StatusCode.INTERNAL, "Internal service error")

    async def GenerateTags(self, request, context):
        try:
            tags = await self.logic.generate_tags(request.title, request.body)
            return ai_service_pb2.TagsResponse(tags=tags)
        except DataParsingError as e:
            self.logger.warning(f"Tags parsing error: {e}")
            await context.abort(grpc.StatusCode.DATA_LOSS, str(e))
        except LLMProviderError as e:
            self.logger.error(f"Tags generation LLM error: {e}")
            await context.abort(grpc.StatusCode.UNAVAILABLE, str(e))
        except Exception as e:
            self.logger.exception("Tag generation failed")
            await context.abort(grpc.StatusCode.INTERNAL, "Internal service error")

    async def GeneratePost(self, request, context):
        try:
            post = await self.logic.generate_post(request.prompt)
            return ai_service_pb2.PostGenerationResponse(
                title=post.title,
                body=post.body,
                summary=post.summary,
                tags=post.tags
            )
        except DataParsingError as e:
            self.logger.warning(f"Post parsing error: {e}")
            await context.abort(grpc.StatusCode.DATA_LOSS, str(e))
        except LLMProviderError as e:
            self.logger.error(f"Post generation LLM error: {e}")
            await context.abort(grpc.StatusCode.UNAVAILABLE, str(e))
        except Exception as e:
            self.logger.exception("Post generation failed")
            await context.abort(grpc.StatusCode.INTERNAL, "Internal service error")