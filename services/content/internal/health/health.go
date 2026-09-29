package health

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/kunalPisolkar24/topos/services/content/internal/cache"
	"github.com/kunalPisolkar24/topos/services/content/internal/domain"
	"github.com/kunalPisolkar24/topos/services/content/internal/metrics"
	"github.com/kunalPisolkar24/topos/services/content/internal/shutdown"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

// Pinger abstracts Mongo ping for testing.
type Pinger interface {
	Ping(ctx context.Context, rp *readpref.ReadPref) error
}

func pingMongoPinger(ctx context.Context, p Pinger) string {
	if p == nil {
		return "unavailable"
	}
	ctx2, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if err := p.Ping(ctx2, readpref.Primary()); err != nil {
		return "unavailable"
	}
	return "ok"
}

func pingRedis(ctx context.Context, c *cache.Cache) string {
	start := time.Now()
	status := "unavailable"
	defer func() {
		duration := time.Since(start).Seconds()
		metrics.DependencyPingDuration.WithLabelValues("redis").Observe(duration)
		if status == "ok" {
			metrics.DependencyUp.WithLabelValues("redis").Set(1)
			metrics.RedisConnected.Set(1)
		} else {
			metrics.DependencyUp.WithLabelValues("redis").Set(0)
			metrics.RedisConnected.Set(0)
		}
	}()
	if c == nil {
		return status
	}
	if c.Degraded() {
		if !c.Healthy() {
			return status
		}
		status = "degraded"
		return status
	}
	if c.Healthy() {
		status = "ok"
		return status
	}
	return status
}

func pingKafka(ctx context.Context, producer domain.EventProducer) string {
	start := time.Now()
	status := "unavailable"
	defer func() {
		metrics.DependencyPingDuration.WithLabelValues("kafka").Observe(time.Since(start).Seconds())
		if status == "ok" {
			metrics.DependencyUp.WithLabelValues("kafka").Set(1)
		} else {
			metrics.DependencyUp.WithLabelValues("kafka").Set(0)
		}
	}()
	if producer == nil {
		return status
	}
	if err := producer.Ping(ctx); err != nil {
		return status
	}
	status = "ok"
	return status
}

func timedPingMongo(ctx context.Context, p Pinger) string {
	start := time.Now()
	status := pingMongoPinger(ctx, p)
	metrics.DependencyPingDuration.WithLabelValues("db").Observe(time.Since(start).Seconds())
	if status == "ok" {
		metrics.DependencyUp.WithLabelValues("db").Set(1)
	} else {
		metrics.DependencyUp.WithLabelValues("db").Set(0)
	}
	return status
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// LivenessHandler always returns 200 unless shutting down.
func LivenessHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		if shutdown.IsShuttingDown() {
			metrics.ProbeChecksTotal.WithLabelValues("liveness", "shutting_down").Inc()
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		metrics.ProbeChecksTotal.WithLabelValues("liveness", "ok").Inc()
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

func ReadyzHandler(mongoClient Pinger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			metrics.ProbeChecksTotal.WithLabelValues("readiness", "shutting_down").Inc()
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down", "db": "unavailable"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		dbStatus := timedPingMongo(ctx, mongoClient)
		if dbStatus != "ok" {
			metrics.ProbeChecksTotal.WithLabelValues("readiness", "degraded").Inc()
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "degraded", "db": dbStatus})
			return
		}
		metrics.ProbeChecksTotal.WithLabelValues("readiness", "ok").Inc()
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "db": dbStatus})
	}
}

// WorkerHealthHandler for content-worker: liveness (healthz) + readiness (readyz).
func WorkerHealthHandler(mongoClient Pinger, cacheClient *cache.Cache, producer domain.EventProducer, runner interface {
	Running() error
	Healthy(ctx context.Context) error
}) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", LivenessHandler())
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			metrics.ProbeChecksTotal.WithLabelValues("readiness", "shutting_down").Inc()
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		dbStatus := timedPingMongo(ctx, mongoClient)
		kafkaStatus := pingKafka(ctx, producer)
		if dbStatus != "ok" || kafkaStatus != "ok" || runner.Running() != nil || runner.Healthy(ctx) != nil {
			metrics.ProbeChecksTotal.WithLabelValues("readiness", "degraded").Inc()
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "degraded", "db": dbStatus, "kafka": kafkaStatus})
			return
		}
		metrics.ProbeChecksTotal.WithLabelValues("readiness", "ok").Inc()
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "db": dbStatus, "kafka": kafkaStatus})
	})
	return mux
}

// SearchWorkerHealthHandler for search/personalizer workers (kafka + worker + ai only) — healthz/readyz only.
func SearchWorkerHealthHandler(producer domain.EventProducer, runner interface {
	Running() error
	Healthy(ctx context.Context) error
}) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", LivenessHandler())
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			metrics.ProbeChecksTotal.WithLabelValues("readiness", "shutting_down").Inc()
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if pingKafka(ctx, producer) != "ok" || runner.Running() != nil || runner.Healthy(ctx) != nil {
			metrics.ProbeChecksTotal.WithLabelValues("readiness", "degraded").Inc()
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "degraded", "kafka": pingKafka(ctx, producer)})
			return
		}
		metrics.ProbeChecksTotal.WithLabelValues("readiness", "ok").Inc()
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "kafka": pingKafka(ctx, producer)})
	})
	return mux
}
