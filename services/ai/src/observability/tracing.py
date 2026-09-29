import logging

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.grpc import GrpcAioInstrumentorServer
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from src.config import settings

logger = logging.getLogger(__name__)


def _normalize_grpc_endpoint(raw: str) -> tuple[str, bool]:
    """Normalize shared OTEL_EXPORTER_OTLP_ENDPOINT to gRPC URL + insecure flag.

    Accepts http://host:4318, host:4317, bare host. Collector serves gRPC on
    :4317, so :4318 is mapped to :4317. Plain http / bare hosts are insecure
    (local collector); https stays secure (direct New Relic).
    """
    e = raw.strip()
    insecure = False
    if e.startswith("http://"):
        insecure = True
        e = e[len("http://") :]
    elif e.startswith("https://"):
        e = e[len("https://") :]
    else:
        insecure = True
    e = e.split("/")[0].strip()
    if e.endswith(":4318"):
        e = e[: -len(":4318")] + ":4317"
    if ":" not in e:
        e = e + ":4317"
    return (f"http://{e}" if insecure else f"https://{e}"), insecure


def setup_tracing() -> None:
    if not settings.OTEL_EXPORTER_OTLP_ENDPOINT:
        logger.info("tracing disabled: OTEL_EXPORTER_OTLP_ENDPOINT not set")
        return

    endpoint, insecure = _normalize_grpc_endpoint(settings.OTEL_EXPORTER_OTLP_ENDPOINT)
    provider = TracerProvider(
        resource=Resource.create({"service.name": settings.OTEL_SERVICE_NAME})
    )
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, insecure=insecure))
    )
    trace.set_tracer_provider(provider)

    GrpcAioInstrumentorServer().instrument()
    HTTPXClientInstrumentor().instrument()
    logger.info("tracing enabled: exporting to %s", endpoint)


def get_span_ids() -> tuple[str, str] | None:
    """Return (trace_id, span_id) of the current span in hex, or None."""
    span = trace.get_current_span()
    context = span.get_span_context()
    if not context.is_valid:
        return None
    return format(context.trace_id, "032x"), format(context.span_id, "016x")
