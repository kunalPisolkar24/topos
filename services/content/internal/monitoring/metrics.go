package monitoring

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	HttpDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "Duration of HTTP requests.",
		Buckets: prometheus.DefBuckets,
	}, []string{"path", "method", "status"})

	CacheOperations = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "cache_operations_total",
		Help: "The total number of cache operations.",
	}, []string{"type", "status"})

	DbDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "db_operation_duration_seconds",
		Help:    "Duration of database operations.",
		Buckets: prometheus.DefBuckets,
	}, []string{"operation"})

	WorkerJobDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "worker_job_processing_duration_seconds",
		Help:    "Time taken to process a worker job",
		Buckets: prometheus.DefBuckets,
	}, []string{"job_type"})

	WorkerJobsProcessed = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "worker_jobs_processed_total",
		Help: "Total number of worker jobs processed",
	}, []string{"job_type", "status"})

	AICircuitBreakerState = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "ai_circuit_breaker_state",
		Help: "Current circuit breaker state for AI service (0=closed, 1=open, 2=half-open)",
	}, []string{"service"})
)

const (
	CacheHit    = "hit"
	CacheMiss   = "miss"
	CacheSet    = "set"
	CacheDel    = "del"
	StatusOk    = "success"
	StatusErr   = "error"
	StatusSkip  = "skipped"
	JobGenerate = "generate_summary"
)

const (
	CBClosed   = 0
	CBOpen     = 1
	CBHalfOpen = 2
)

func RecordCacheHit() {
	CacheOperations.WithLabelValues("read", CacheHit).Inc()
}

func RecordCacheMiss() {
	CacheOperations.WithLabelValues("read", CacheMiss).Inc()
}

func RecordCacheSet() {
	CacheOperations.WithLabelValues("write", CacheSet).Inc()
}

func RecordCacheDel() {
	CacheOperations.WithLabelValues("write", CacheDel).Inc()
}