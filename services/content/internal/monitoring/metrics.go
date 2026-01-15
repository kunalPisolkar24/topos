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
)

const (
	CacheHit  = "hit"
	CacheMiss = "miss"
	CacheSet  = "set"
	CacheDel  = "del"
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