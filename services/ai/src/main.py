import asyncio
import logging
import signal
import grpc
import httpx
from prometheus_client import start_http_server
from grpc_health.v1 import health_pb2, health_pb2_grpc
from src.config.settings import settings
from src.api.handlers import AIHandler
from src.generated import ai_service_pb2_grpc
from src.infrastructure.llm.lightning_client import LightningClient
from src.infrastructure.logging.config import setup_logging
from src.infrastructure.monitoring.interceptors import PrometheusInterceptor
from src.usecases.content_logic import ContentLogic
from src.utils.sanitizer import Sanitizer


class AIHealthServicer(health_pb2_grpc.HealthServicer):
    def __init__(self, llm_provider: LightningClient):
        self._llm_provider = llm_provider

    async def Check(self, request, context):
        try:
            healthy = await asyncio.wait_for(self._llm_provider.is_healthy(), timeout=5.0)
        except (asyncio.TimeoutError, Exception):
            healthy = False
        if healthy:
            return health_pb2.HealthCheckResponse(status=health_pb2.HealthCheckResponse.SERVING)
        return health_pb2.HealthCheckResponse(status=health_pb2.HealthCheckResponse.NOT_SERVING)


async def serve():
    setup_logging()
    logger = logging.getLogger("Main")

    start_http_server(settings.METRICS_PORT)
    logger.info(f"Prometheus metrics exposed on port {settings.METRICS_PORT}")

    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(settings.LLM_REQUEST_TIMEOUT),
        limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
    )

    shutdown_event = asyncio.Event()

    try:
        llm_provider = LightningClient(http_client)
        content_logic = ContentLogic(llm_provider, Sanitizer())
        handler = AIHandler(content_logic)

        interceptors = [PrometheusInterceptor()]
        server = grpc.aio.server(
            interceptors=interceptors,
            maximum_concurrent_rpcs=50
        )
        
        ai_service_pb2_grpc.add_AIServiceServicer_to_server(handler, server)
        
        health_servicer = AIHealthServicer(llm_provider)
        health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)

        listen_addr = f"[::]:{settings.PORT}"
        server.add_insecure_port(listen_addr)
        
        logger.info(f"AI Intelligence Service starting on {listen_addr}")
        await server.start()

        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, shutdown_event.set)

        logger.info("Server running, waiting for termination signal...")
        await shutdown_event.wait()

        logger.info("Shutting down gRPC server with 30s grace period...")
        await server.stop(30)
        await server.wait_for_termination()

    except Exception:
        logger.exception("Server crashed")
        raise
    finally:
        logger.info("Shutting down LLM client and HTTP client...")
        await llm_provider.close()
        await http_client.aclose()

if __name__ == "__main__":
    try:
        asyncio.run(serve())
    except KeyboardInterrupt:
        pass