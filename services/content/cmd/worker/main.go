package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kunalPisolkar24/topos/services/content/internal/bootstrap"
	"github.com/kunalPisolkar24/topos/services/content/internal/cache"
	"github.com/kunalPisolkar24/topos/services/content/internal/config"
	"github.com/kunalPisolkar24/topos/services/content/internal/domain"
	"github.com/kunalPisolkar24/topos/services/content/internal/observability"
	"github.com/kunalPisolkar24/topos/services/content/internal/repository"
	"github.com/kunalPisolkar24/topos/services/content/internal/service"
	"github.com/kunalPisolkar24/topos/services/content/internal/shutdown"
	"github.com/kunalPisolkar24/topos/services/content/internal/worker"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

const (
	serviceName     = "content-worker"
	healthTimeout   = 2 * time.Second
	shutdownTimeout = 10 * time.Second
)

func main() {
	if err := run(); err != nil {
		slog.Error("worker terminated with error", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg := config.LoadConfig()
	observability.SetupLogging(cfg.LogFormat, cfg.LogLevel, serviceName)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	deps, err := bootstrap.New(ctx, cfg, serviceName)
	if err != nil {
		return err
	}
	defer deps.Close(context.Background())

	processor := service.NewPostService(
		repository.NewMongoPostRepository(deps.Mongo.Database(cfg.DbName)),
		repository.NewMongoTagRepository(deps.Mongo.Database(cfg.DbName)),
		deps.AI,
		deps.Producer,
		deps.Cache,
	)

	w, err := worker.NewWorker(
		cfg.KafkaBrokers,
		cfg.KafkaConsumerGroupID,
		[]string{cfg.KafkaTopic},
		cfg.KafkaDLQTopic,
		cfg.WorkerConcurrency,
		processor,
		deps.AI,
		deps.Producer,
	)
	if err != nil {
		return err
	}
	defer w.Close()

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           newHealthHandler(deps.Mongo, deps.Cache, deps.Producer, w),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		slog.Info("worker health server listening", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("health server failed", "error", err)
			stop()
		}
	}()

	go w.Start(ctx)
	slog.Info("worker started", "group", cfg.KafkaConsumerGroupID, "topic", cfg.KafkaTopic, "concurrency", cfg.WorkerConcurrency)

	<-ctx.Done()
	shutdown.SetShuttingDown(true)
	slog.Info("shutting down worker")

	select {
	case <-w.Done():
	case <-time.After(shutdownTimeout):
		slog.Warn("worker did not stop within timeout")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return server.Shutdown(shutdownCtx)
}

type pinger interface {
	Ping(ctx context.Context, rp *readpref.ReadPref) error
}

func pingMongo(ctx context.Context, p pinger) string {
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

// newHealthHandler reports liveness (always 200) and readiness (503 when deps down).
func newHealthHandler(mongoClient pinger, cacheClient *cache.Cache, producer domain.EventProducer, w *worker.Worker) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/health", func(rw http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(rw, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), healthTimeout)
		defer cancel()
		writeJSON(rw, http.StatusOK, map[string]string{
			"status": "ok",
			"db":     pingMongo(ctx, mongoClient),
			"redis":  pingRedis(ctx, cacheClient),
			"kafka":  pingKafka(ctx, producer),
			"worker": func() string {
				if w.Running() == nil {
					return "ok"
				}
				return "unavailable"
			}(),
			"ai": func() string {
				if w.Healthy(ctx) == nil {
					return "ok"
				}
				return "unavailable"
			}(),
		})
	})
	mux.HandleFunc("/healthz", func(rw http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(rw, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		writeJSON(rw, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/ready", func(rw http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(rw, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), healthTimeout)
		defer cancel()
		dbStatus := pingMongo(ctx, mongoClient)
		kafkaStatus := pingKafka(ctx, producer)
		workerErr := w.Running()
		aiErr := w.Healthy(ctx)
		if dbStatus != "ok" || kafkaStatus != "ok" || workerErr != nil || aiErr != nil {
			writeJSON(rw, http.StatusServiceUnavailable, map[string]string{"status": "degraded", "db": dbStatus, "kafka": kafkaStatus})
			return
		}
		writeJSON(rw, http.StatusOK, map[string]string{"status": "ok", "db": dbStatus, "kafka": kafkaStatus})
	})
	mux.HandleFunc("/readyz", func(rw http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(rw, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), healthTimeout)
		defer cancel()
		dbStatus := pingMongo(ctx, mongoClient)
		kafkaStatus := pingKafka(ctx, producer)
		if dbStatus != "ok" || kafkaStatus != "ok" || w.Running() != nil || w.Healthy(ctx) != nil {
			writeJSON(rw, http.StatusServiceUnavailable, map[string]string{"status": "degraded"})
			return
		}
		writeJSON(rw, http.StatusOK, map[string]string{"status": "ok"})
	})
	return mux
}
