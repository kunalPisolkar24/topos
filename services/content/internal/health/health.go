package health

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/kunalPisolkar24/topos/services/content/internal/cache"
	"github.com/kunalPisolkar24/topos/services/content/internal/domain"
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
	if c == nil {
		return "unavailable"
	}
	if c.Degraded() {
		if !c.Healthy() {
			return "unavailable"
		}
		return "degraded"
	}
	if c.Healthy() {
		return "ok"
	}
	return "unavailable"
}

func pingKafka(ctx context.Context, producer domain.EventProducer) string {
	if producer == nil {
		return "unavailable"
	}
	if err := producer.Ping(ctx); err != nil {
		return "unavailable"
	}
	return "ok"
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
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

// ReadinessHandler for content-service: 503 when mongo is unavailable.
func ReadinessHandler(mongoClient Pinger, cacheClient *cache.Cache, producer domain.EventProducer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down", "db": "unavailable"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		dbStatus := pingMongoPinger(ctx, mongoClient)
		if dbStatus != "ok" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "degraded", "db": dbStatus, "redis": pingRedis(ctx, cacheClient), "kafka": pingKafka(ctx, producer)})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "db": dbStatus, "redis": pingRedis(ctx, cacheClient), "kafka": pingKafka(ctx, producer)})
	}
}

func ReadyzHandler(mongoClient Pinger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down", "db": "unavailable"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		dbStatus := pingMongoPinger(ctx, mongoClient)
		if dbStatus != "ok" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "degraded", "db": dbStatus})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "db": dbStatus})
	}
}

// ServiceHealthHandler is liveness for content-service with full dep reporting.
func ServiceHealthHandler(mongoClient Pinger, cacheClient *cache.Cache, producer domain.EventProducer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down", "db": "unavailable", "redis": "unavailable", "kafka": "unavailable"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "db": pingMongoPinger(ctx, mongoClient), "redis": pingRedis(ctx, cacheClient), "kafka": pingKafka(ctx, producer)})
	}
}

// WorkerHealthHandler for content-worker: liveness + readiness combined via health package helpers.
func WorkerHealthHandler(mongoClient Pinger, cacheClient *cache.Cache, producer domain.EventProducer, runner interface {
	Running() error
	Healthy(ctx context.Context) error
}) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "ok",
			"db":     pingMongoPinger(ctx, mongoClient),
			"redis":  pingRedis(ctx, cacheClient),
			"kafka":  pingKafka(ctx, producer),
			"worker": func() string {
				if runner.Running() == nil {
					return "ok"
				}
				return "unavailable"
			}(),
			"ai": func() string {
				if runner.Healthy(ctx) == nil {
					return "ok"
				}
				return "unavailable"
			}(),
		})
	})
	mux.HandleFunc("/healthz", LivenessHandler())
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		dbStatus := pingMongoPinger(ctx, mongoClient)
		kafkaStatus := pingKafka(ctx, producer)
		if dbStatus != "ok" || kafkaStatus != "ok" || runner.Running() != nil || runner.Healthy(ctx) != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "degraded", "db": dbStatus, "kafka": kafkaStatus})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "db": dbStatus, "kafka": kafkaStatus})
	})
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if pingMongoPinger(ctx, mongoClient) != "ok" || pingKafka(ctx, producer) != "ok" || runner.Running() != nil || runner.Healthy(ctx) != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "degraded"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	return mux
}

// SearchWorkerHealthHandler for search/personalizer workers (kafka + worker + ai only).
func SearchWorkerHealthHandler(producer domain.EventProducer, runner interface {
	Running() error
	Healthy(ctx context.Context) error
}) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "ok",
			"kafka":  pingKafka(ctx, producer),
			"worker": func() string {
				if runner.Running() == nil {
					return "ok"
				}
				return "unavailable"
			}(),
			"ai": func() string {
				if runner.Healthy(ctx) == nil {
					return "ok"
				}
				return "unavailable"
			}(),
		})
	})
	mux.HandleFunc("/healthz", LivenessHandler())
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if pingKafka(ctx, producer) != "ok" || runner.Running() != nil || runner.Healthy(ctx) != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "degraded", "kafka": pingKafka(ctx, producer)})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "kafka": pingKafka(ctx, producer)})
	})
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if pingKafka(ctx, producer) != "ok" || runner.Running() != nil || runner.Healthy(ctx) != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "degraded"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	return mux
}
