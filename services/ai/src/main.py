import asyncio
import logging
import grpc
import httpx
from src.config.settings import settings
from src.api.handlers import AIHandler
from src.generated import ai_service_pb2_grpc
from src.infrastructure.llm.lightning_client import LightningClient
from src.usecases.content_logic import ContentLogic

async def serve():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger("Main")

    http_client = httpx.AsyncClient(
        timeout=settings.TIMEOUT_SECONDS,
        limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
    )

    try:
        llm_provider = LightningClient(http_client)
        content_logic = ContentLogic(llm_provider)
        handler = AIHandler(content_logic)

        server = grpc.aio.server()
        ai_service_pb2_grpc.add_AIServiceServicer_to_server(handler, server)
        
        listen_addr = f"[::]:{settings.PORT}"
        server.add_insecure_port(listen_addr)
        
        logger.info(f"AI Intelligence Service starting on {listen_addr}")
        await server.start()
        await server.wait_for_termination()
        
    except Exception as e:
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