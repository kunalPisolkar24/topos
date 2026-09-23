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

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/kunalPisolkar24/topos/services/content/graph"
	"github.com/kunalPisolkar24/topos/services/content/internal/bootstrap"
	"github.com/kunalPisolkar24/topos/services/content/internal/cache"
	"github.com/kunalPisolkar24/topos/services/content/internal/config"
	"github.com/kunalPisolkar24/topos/services/content/internal/domain"
	"github.com/kunalPisolkar24/topos/services/content/internal/middleware"
	"github.com/kunalPisolkar24/topos/services/content/internal/observability"
	"github.com/kunalPisolkar24/topos/services/content/internal/repository"
	"github.com/kunalPisolkar24/topos/services/content/internal/service"
	"github.com/kunalPisolkar24/topos/services/content/internal/shutdown"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

const (
	serviceName     = "content-service"
	queryPath       = "/query"
	shutdownTimeout = 10 * time.Second
	healthTimeout   = 2 * time.Second
)

func main() {
	if err := run(); err != nil {
		slog.Error("server terminated with error", "error", err)
		os.Exit(1)
	}
}

// run wires everything together and blocks until the server stops.
func run() error {
	cfg := config.LoadConfig()
	observability.SetupLogging(cfg.LogFormat, cfg.LogLevel, serviceName)
	if err := validateConfig(cfg); err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	deps, err := bootstrap.New(ctx, cfg, serviceName)
	if err != nil {
		return err
	}
	defer deps.Close(context.Background())

	return serve(ctx, newServer(cfg, newResolver(cfg, deps), deps.Mongo, deps.Cache, deps.Producer))
}

// validateConfig returns an error when required settings are missing.
func validateConfig(cfg config.Config) error {
	if cfg.JwtSecret == "" {
		return errors.New("JWT_SECRET is required")
	}
	if cfg.InternalToken == "" {
		return errors.New("INTERNAL_TOKEN is required")
	}
	return nil
}

// newResolver builds the services and graph resolver used by the API.
func newResolver(cfg config.Config, deps *bootstrap.Dependencies) *graph.Resolver {
	database := deps.Mongo.Database(cfg.DbName)
	postRepo := repository.NewMongoPostRepository(database)
	tagRepo := repository.NewMongoTagRepository(database)
	chatRepo := repository.NewMongoChatRepository(database)

	draftRepo := repository.NewMongoPostDraftRepository(database)

	return graph.NewResolver(
		service.NewPostService(postRepo, tagRepo, deps.AI, deps.Producer, deps.Cache),
		service.NewTagService(tagRepo, deps.Cache),
		service.NewChatService(chatRepo, deps.AI),
		service.NewPostInteractionService(repository.NewMongoPostInteractionRepository(database), deps.Producer, deps.Cache),
		service.NewPostDraftService(draftRepo, deps.AI, service.NewPostService(postRepo, tagRepo, deps.AI, deps.Producer, deps.Cache)),
	)
}

// newHandler wires the GraphQL endpoint, the playground, and the health
// check. The /query handler is traced (span covers auth, resolution and
// outbound calls); every request carries a request id in its context.
func newHandler(cfg config.Config, resolver *graph.Resolver, mongoClient pinger, cacheClient *cache.Cache, producer domain.EventProducer) http.Handler {
	gql := handler.NewDefaultServer(graph.NewExecutableSchema(graph.Config{Resolvers: resolver}))
	gql.SetErrorPresenter(graph.PresentError)
	gql.SetRecoverFunc(graph.RecoverError)

	var gqlHandler http.Handler = gql
	if resolver != nil && resolver.PostService != nil {
		gqlHandler = graph.WithBatching(resolver.PostService, resolver.InteractionService, gql)
	}

	mux := http.NewServeMux()
	mux.Handle(queryPath, otelhttp.NewHandler(
		middleware.RecoverMiddleware(middleware.MetricsMiddleware(middleware.AuthMiddleware(cfg)(gqlHandler))),
		"graphql",
	))
	mux.Handle("/", playground.Handler("GraphQL playground", queryPath))
	mux.HandleFunc("/health", healthHandler(mongoClient, cacheClient, producer))
	mux.HandleFunc("/healthz", healthzHandler())
	mux.HandleFunc("/ready", readyHandler(mongoClient, cacheClient, producer))
	mux.HandleFunc("/readyz", readyzHandler(mongoClient))
	mux.Handle("/metrics", promhttp.Handler())
	if resolver != nil && resolver.PostService != nil {
		mux.Handle(
			"GET /internal/posts/{id}",
			middleware.InternalAuthMiddleware(cfg.InternalToken)(
				internalPostBodyHandler(resolver.PostService),
			),
		)
	}
	return middleware.RequestIDMiddleware(mux)
}

// pinger abstracts the mongo connectivity check so tests can fake it.
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
		// Distinguish degraded vs unavailable via health ping.
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

// healthHandler is liveness: always 200 unless shutting down, reports deps.
func healthHandler(mongoClient pinger, cacheClient *cache.Cache, producer domain.EventProducer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down", "db": "unavailable", "redis": "unavailable", "kafka": "unavailable"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), healthTimeout)
		defer cancel()
		dbStatus := pingMongo(ctx, mongoClient)
		redisStatus := pingRedis(ctx, cacheClient)
		kafkaStatus := pingKafka(ctx, producer)
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "db": dbStatus, "redis": redisStatus, "kafka": kafkaStatus})
	}
}

func healthzHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

// readyHandler is readiness: 503 when mongo is unavailable (source of truth).
func readyHandler(mongoClient pinger, cacheClient *cache.Cache, producer domain.EventProducer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down", "db": "unavailable", "redis": "unavailable", "kafka": "unavailable"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), healthTimeout)
		defer cancel()
		dbStatus := pingMongo(ctx, mongoClient)
		redisStatus := pingRedis(ctx, cacheClient)
		kafkaStatus := pingKafka(ctx, producer)
		if dbStatus != "ok" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "degraded", "db": dbStatus, "redis": redisStatus, "kafka": kafkaStatus})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "db": dbStatus, "redis": redisStatus, "kafka": kafkaStatus})
	}
}

func readyzHandler(mongoClient pinger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if shutdown.IsShuttingDown() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "shutting_down", "db": "unavailable"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), healthTimeout)
		defer cancel()
		dbStatus := pingMongo(ctx, mongoClient)
		if dbStatus != "ok" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "degraded", "db": dbStatus})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "db": dbStatus})
	}
}

// newServer builds the HTTP server with routes attached.
func newServer(cfg config.Config, resolver *graph.Resolver, mongoClient pinger, cacheClient *cache.Cache, producer domain.EventProducer) *http.Server {
	return &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           newHandler(cfg, resolver, mongoClient, cacheClient, producer),
		ReadHeaderTimeout: 5 * time.Second,
	}
}

// serve runs the server until it errors or ctx is cancelled, then shuts down gracefully.
func serve(ctx context.Context, srv *http.Server) error {
	errCh := make(chan error, 1)
	go func() {
		slog.Info("content service listening", "addr", srv.Addr, "playground", queryPath)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	shutdown.SetShuttingDown(true)
	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return err
	}
	if err := <-errCh; err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
