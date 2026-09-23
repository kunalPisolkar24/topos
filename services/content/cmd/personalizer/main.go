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
	"github.com/kunalPisolkar24/topos/services/content/internal/config"
	"github.com/kunalPisolkar24/topos/services/content/internal/domain"
	"github.com/kunalPisolkar24/topos/services/content/internal/observability"
	"github.com/kunalPisolkar24/topos/services/content/internal/shutdown"
	"github.com/kunalPisolkar24/topos/services/content/internal/worker"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	serviceName     = "content-personalizer"
	healthTimeout   = 2 * time.Second
	shutdownTimeout = 10 * time.Second
)

func main() {
	if err := run(); err != nil {
		slog.Error("personalizer worker terminated with error", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg := config.LoadConfig()
	observability.SetupLogging(cfg.LogFormat, cfg.LogLevel, serviceName)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	deps, err := bootstrap.NewSearch(ctx, cfg, serviceName)
	if err != nil {
		return err
	}
	defer deps.Close(context.Background())

	w, err := worker.NewPersonalizerWorker(
		cfg.KafkaBrokers,
		cfg.KafkaPersonalizerConsumerGroupID,
		[]string{cfg.KafkaUserInteractedTopic},
		cfg.KafkaDLQTopic,
		cfg.WorkerConcurrency,
		deps.AI,
		deps.Producer,
	)
	if err != nil {
		return err
	}
	defer w.Close()

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           newHealthHandler(deps.Producer, w),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		slog.Info("personalizer worker health server listening", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("health server failed", "error", err)
			stop()
		}
	}()

	go w.Start(ctx)
	slog.Info("personalizer worker started", "group", cfg.KafkaPersonalizerConsumerGroupID, "topic", cfg.KafkaUserInteractedTopic, "concurrency", cfg.WorkerConcurrency)

	<-ctx.Done()
	shutdown.SetShuttingDown(true)
	slog.Info("shutting down personalizer worker")

	select {
	case <-w.Done():
	case <-time.After(shutdownTimeout):
		slog.Warn("personalizer worker did not stop within timeout")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return server.Shutdown(shutdownCtx)
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

// newHealthHandler reports liveness (always 200) and readiness (503 when kafka/worker/ai down).
func newHealthHandler(producer domain.EventProducer, w *worker.PersonalizerWorker) http.Handler {
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
		kafkaStatus := pingKafka(ctx, producer)
		if kafkaStatus != "ok" || w.Running() != nil || w.Healthy(ctx) != nil {
			writeJSON(rw, http.StatusServiceUnavailable, map[string]string{"status": "degraded", "kafka": kafkaStatus})
			return
		}
		writeJSON(rw, http.StatusOK, map[string]string{"status": "ok", "kafka": kafkaStatus})
	})
	mux.HandleFunc("/readyz", func(rw http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(rw, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), healthTimeout)
		defer cancel()
		if pingKafka(ctx, producer) != "ok" || w.Running() != nil || w.Healthy(ctx) != nil {
			writeJSON(rw, http.StatusServiceUnavailable, map[string]string{"status": "degraded"})
			return
		}
		writeJSON(rw, http.StatusOK, map[string]string{"status": "ok"})
	})
	return mux
}
