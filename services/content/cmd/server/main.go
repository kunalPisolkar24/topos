package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/kunalPisolkar24/blogapp/services/content/graph"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/bootstrap"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/config"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/health"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/middleware"
	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

func main() {
	logger.Init()
	if err := run(); err != nil {
		logger.Error("Server terminated with error", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.LoadConfig()
	if err != nil {
		return err
	}

	deps, err := bootstrap.Load(context.Background(), bootstrap.RoleServer, cfg)
	if err != nil {
		return err
	}
	defer deps.Shutdown()

	srv := handler.NewDefaultServer(graph.NewExecutableSchema(graph.Config{
		Resolvers: &graph.Resolver{
			PostService: deps.PostService,
			TagService:  deps.TagService,
		},
	}))

	mux := http.NewServeMux()
	mux.Handle("/query", middleware.CORS(middleware.CORSConfig{
		AllowedOrigins: cfg.CORSOrigins,
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type", "Apollo-Require-Preflight"},
		MaxAgeSeconds:  86400,
	})(middleware.MetricsMiddleware(middleware.AuthMiddleware(cfg)(srv))))
	mux.Handle("/", playground.Handler("GraphQL playground", "/query"))
	mux.Handle("/metrics", promhttp.Handler())

	healthChecker := health.NewChecker(2 * time.Second)
	healthChecker.Register("redis", func(ctx context.Context) error {
		return deps.RedisClient.Ping(ctx).Err()
	})
	healthChecker.Register("mongo", func(ctx context.Context) error {
		return deps.MongoClient.Ping(ctx, readpref.Primary())
	})
	healthChecker.Register("kafka", func(ctx context.Context) error {
		if deps.EventProd == nil {
			return errors.New("kafka producer not initialized")
		}
		return deps.EventProd.Ping(ctx)
	})
	mux.Handle("/health", healthChecker.Handler())

	logger.Info("Content Service starting", "port", cfg.Port)

	server := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: mux,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Server failed", "error", err)
			stop <- syscall.SIGTERM
		}
	}()

	<-stop
	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Error("Server forced to shutdown", "error", err)
	}

	logger.Info("Server exited properly")
	return nil
}
