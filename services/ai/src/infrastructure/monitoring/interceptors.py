import asyncio
import time
import grpc
from grpc.aio import ServerInterceptor
from src.infrastructure.monitoring.metrics import (
    GRPC_REQUEST_LATENCY, 
    GRPC_REQUEST_COUNT, 
    ACTIVE_REQUESTS
)

class PrometheusInterceptor(ServerInterceptor):
    async def intercept_service(self, continuation, handler_call_details):
        method_name = handler_call_details.method
        start_time = time.perf_counter()
        status_code = "OK"
        
        ACTIVE_REQUESTS.inc()
        
        try:
            return await continuation(handler_call_details)
        except grpc.RpcError as e:
            status_code = e.code().name
            raise e
        except asyncio.CancelledError:
            status_code = "CANCELLED"
            raise
        except Exception:
            status_code = "INTERNAL"
            raise
        finally:
            duration = time.perf_counter() - start_time
            ACTIVE_REQUESTS.dec()
            
            GRPC_REQUEST_LATENCY.labels(
                method=method_name, 
                status=status_code
            ).observe(duration)
            
            GRPC_REQUEST_COUNT.labels(
                method=method_name, 
                status=status_code
            ).inc()