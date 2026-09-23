// Package bootstrap wires the shared infrastructure dependencies for the
// API and the worker: tracing, mongo, redis, the AI client and Kafka.
package bootstrap

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/kunalPisolkar24/topos/services/content/internal/cache"
	"github.com/kunalPisolkar24/topos/services/content/internal/config"
	"github.com/kunalPisolkar24/topos/services/content/internal/db"
	"github.com/kunalPisolkar24/topos/services/content/internal/domain"
	"github.com/kunalPisolkar24/topos/services/content/internal/infrastructure/ai"
	"github.com/kunalPisolkar24/topos/services/content/internal/infrastructure/messaging"
	"github.com/kunalPisolkar24/topos/services/content/internal/observability"
	"go.mongodb.org/mongo-driver/mongo"
)

// Dependencies holds the shared infrastructure used by the services.
// Cache is always non-nil; when redis is unavailable it operates in
// degraded mode and falls through to MongoDB.
type Dependencies struct {
	Mongo           *mongo.Client
	Cache           *cache.Cache
	AI              domain.AIService
	Producer        domain.EventProducer
	ShutdownTracing func(context.Context) error
}

// New connects to mongo, redis, the AI service and Kafka, and wires the
// OpenTelemetry SDK. Mongo is best-effort: when unavailable the service
// still boots in degraded mode (ready 503) so WITH_MONGO=0 can be
// exercised without crash-looping. Redis is resilient via its breaker.
func New(ctx context.Context, cfg config.Config, serviceName string) (*Dependencies, error) {
	shutdownTracing, err := observability.SetupTracing(ctx, cfg.OtelEndpoint, serviceName)
	if err != nil {
		return nil, fmt.Errorf("setup tracing: %w", err)
	}

	mongoClient, err := db.Connect(ctx, cfg.MongoURI)
	if err != nil {
		slog.Warn("mongo unavailable, running in degraded mode", "error", err)
		// Keep a lazy client for health probes; real operations will fail
		// with SERVICE_UNAVAILABLE until the server returns.
		if lazy, lerr := db.ConnectLazy(ctx, cfg.MongoURI); lerr == nil {
			mongoClient = lazy
		} else {
			shutdownTracing(context.Background())
			return nil, fmt.Errorf("connect mongo (lazy): %w", lerr)
		}
	} else {
		slog.Info("connected to mongo", "db", cfg.DbName)
		if err := db.EnsureIndexes(ctx, mongoClient.Database(cfg.DbName)); err != nil {
			slog.Warn("mongo ensure indexes failed, running degraded", "error", err)
		} else {
			slog.Info("mongo indexes ready")
		}
	}

	cacheOpts := cache.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
	}
	cacheClient := cache.NewResilient(ctx, cacheOpts)
	if cacheClient.Degraded() {
		slog.Warn("redis degraded, caching in fail-open mode", "addr", cfg.RedisAddr)
	} else {
		slog.Info("connected to redis", "addr", cfg.RedisAddr)
	}

	aiClient := ai.NewResilientClient(cfg.AIServiceURL)
	slog.Info("ai client configured", "addr", cfg.AIServiceURL)

	producer := messaging.NewKafkaProducer(cfg.KafkaBrokers, cfg.KafkaTopic, cfg.KafkaUserInteractedTopic)

	return &Dependencies{
		Mongo:           mongoClient,
		Cache:           cacheClient,
		AI:              aiClient,
		Producer:        producer,
		ShutdownTracing: shutdownTracing,
	}, nil
}

// Close shuts down every dependency in reverse order of creation. It is
// nil-safe so it can always be deferred.
func (d *Dependencies) Close(ctx context.Context) {
	if d.Producer != nil {
		_ = d.Producer.Close()
	}
	if d.AI != nil {
		_ = d.AI.Close()
	}
	if d.Cache != nil {
		_ = d.Cache.Close()
	}
	if d.Mongo != nil {
		_ = d.Mongo.Disconnect(ctx)
	}
	if d.ShutdownTracing != nil {
		_ = d.ShutdownTracing(ctx)
	}
}

// SearchDependencies holds the infrastructure the search worker needs:
// the AI client for index writes and the Kafka producer for the DLQ.
type SearchDependencies struct {
	AI              domain.AIService
	Producer        domain.EventProducer
	ShutdownTracing func(context.Context) error
}

// NewSearch wires tracing, the AI client and Kafka only. Unlike New it
// requires neither mongo nor redis, which the search worker does not use.
func NewSearch(ctx context.Context, cfg config.Config, serviceName string) (*SearchDependencies, error) {
	shutdownTracing, err := observability.SetupTracing(ctx, cfg.OtelEndpoint, serviceName)
	if err != nil {
		return nil, fmt.Errorf("setup tracing: %w", err)
	}

	return &SearchDependencies{
		AI:              ai.NewResilientClient(cfg.AIServiceURL),
		Producer:        messaging.NewKafkaProducer(cfg.KafkaBrokers, cfg.KafkaTopic, cfg.KafkaUserInteractedTopic),
		ShutdownTracing: shutdownTracing,
	}, nil
}

// Close shuts down every dependency in reverse order of creation.
func (d *SearchDependencies) Close(ctx context.Context) {
	if d.Producer != nil {
		_ = d.Producer.Close()
	}
	if d.AI != nil {
		_ = d.AI.Close()
	}
	if d.ShutdownTracing != nil {
		_ = d.ShutdownTracing(ctx)
	}
}
