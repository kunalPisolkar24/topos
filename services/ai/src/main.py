import asyncio
import logging
import grpc
import httpx
from prometheus_client import start_http_server
from src.config.settings import settings
from src.api.handlers import AIHandler
from src.generated import ai_service_pb2_grpc
from src.infrastructure.llm.lightning_client import LightningClient
from src.infrastructure.llm.mock_provider import MockLLMProvider
from src.infrastructure.logging.config import setup_logging
from src.infrastructure.monitoring.interceptors import PrometheusInterceptor
from src.usecases.content_logic import ContentLogic

async def serve():
    setup_logging()
    logger = logging.getLogger("Main")

    start_http_server(settings.METRICS_PORT)
    logger.info(f"Prometheus metrics exposed on port {settings.METRICS_PORT}")

    if settings.LOAD_TEST_MODE:
        logger.info("Running in load test mode with mock LLM provider")
        llm_provider = MockLLMProvider()
        content_logic = ContentLogic(llm_provider)
        handler = AIHandler(content_logic)

        interceptors = [PrometheusInterceptor()]
        server = grpc.aio.server(interceptors=interceptors)

        ai_service_pb2_grpc.add_AIServiceServicer_to_server(handler, server)

        listen_addr = f"[::]:{settings.PORT}"
        server.add_insecure_port(listen_addr)

        logger.info(
            f"AI Intelligence Service (load test mode) starting on {listen_addr}"
        )
        await server.start()
        await server.wait_for_termination()
        return

    http_client = httpx.AsyncClient(
        timeout=settings.TIMEOUT_SECONDS,
        limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
    )

    try:
        llm_provider = LightningClient(http_client)
        content_logic = ContentLogic(llm_provider)
        handler = AIHandler(content_logic)

        interceptors = [PrometheusInterceptor()]
        server = grpc.aio.server(interceptors=interceptors)
        
        ai_service_pb2_grpc.add_AIServiceServicer_to_server(handler, server)
        
        listen_addr = f"[::]:{settings.PORT}"
        server.add_insecure_port(listen_addr)
        
        logger.info(f"AI Intelligence Service starting on {listen_addr}")
        await server.start()
        await server.wait_for_termination()
        
    except Exception:
        logger.exception("Server crashed")
        raise
    finally:
        logger.info("Shutting down HTTP client...")
        await http_client.aclose()

if __name__ == "__main__":
    try:
        asyncio.run(serve())
    except KeyboardInterrupt:
        pass