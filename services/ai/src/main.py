import asyncio
import logging
import grpc
from src.config.settings import settings
from src.api.handlers import AIHandler
from src.generated import ai_service_pb2_grpc

async def serve():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger("Main")

    server = grpc.aio.server()
    ai_service_pb2_grpc.add_AIServiceServicer_to_server(AIHandler(), server)
    
    listen_addr = f"[::]:{settings.PORT}"
    server.add_insecure_port(listen_addr)
    
    logger.info(f"AI Intelligence Service starting on {listen_addr}")
    await server.start()
    await server.wait_for_termination()

if __name__ == "__main__":
    try:
        asyncio.run(serve())
    except KeyboardInterrupt:
        pass