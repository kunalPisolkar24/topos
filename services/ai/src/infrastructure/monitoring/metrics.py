from prometheus_client import Counter, Histogram, Gauge

GRPC_REQUEST_LATENCY = Histogram(
    'grpc_request_duration_seconds',
    'Time spent processing gRPC requests',
    ['method', 'status']
)

GRPC_REQUEST_COUNT = Counter(
    'grpc_requests_total',
    'Total number of gRPC requests',
    ['method', 'status']
)

LLM_PROVIDER_LATENCY = Histogram(
    'llm_provider_duration_seconds',
    'Time spent waiting for LLM provider response',
    ['provider', 'endpoint']
)

LLM_TOKEN_ERROR_COUNT = Counter(
    'llm_provider_errors_total',
    'Total number of errors from LLM provider',
    ['provider', 'error_type']
)

ACTIVE_REQUESTS = Gauge(
    'grpc_active_requests',
    'Number of requests currently being processed'
)

CIRCUIT_BREAKER_STATE = Gauge(
    'llm_circuit_breaker_state',
    'Circuit breaker state: 0=closed, 1=half-open, 2=open',
    ['provider']
)

CIRCUIT_BREAKER_REJECTED = Counter(
    'llm_circuit_breaker_rejected_total',
    'Requests rejected by circuit breaker',
    ['provider']
)