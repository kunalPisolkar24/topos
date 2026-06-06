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
	"github.com/kunalPisolkar24/blogapp/services/content/internal/config"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/db"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/health"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/ai"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/cache"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/messaging"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/middleware"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/repository"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/service"
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

	mongoClient, err := db.Connect(cfg.MongoURI)
	if err != nil {
		return err
	}
	defer func() {
		if dErr := mongoClient.Disconnect(context.Background()); dErr != nil {
			logger.Error("Failed to disconnect MongoDB", "error", dErr)
		}
	}()

	redisClient, err := cache.NewRedisClientAuto(cfg)
	if err != nil {
		logger.Error("Failed to connect to Redis", "mode", cfg.RedisMode, "error", err)
		return err
	}
	defer func() {
		if cErr := redisClient.Close(); cErr != nil {
			logger.Error("Failed to close Redis client", "error", cErr)
		}
	}()

	kafkaProducer := messaging.NewKafkaProducer(cfg.KafkaBrokers, cfg.KafkaTopic)
	defer func() {
		if cErr := kafkaProducer.Close(); cErr != nil {
			logger.Error("Failed to close Kafka producer", "error", cErr)
		}
	}()

	aiClient, err := ai.NewResilientAIClient(cfg.AIServiceURL, cfg.AIRequired, cfg.AIDialTimeout)
	if err != nil {
		return err
	}
	defer func() {
		if cErr := aiClient.Close(); cErr != nil {
			logger.Error("Failed to close AI client", "error", cErr)
		}
	}()

	database := mongoClient.Database(cfg.DbName)

	if err := db.EnsureIndexes(context.Background(), database); err != nil {
		return err
	}

	var postRepo = repository.NewMongoPostRepository(database)
	postRepo = repository.NewCachedPostRepository(postRepo, redisClient)

	tagRepo := repository.NewMongoTagRepository(database)

	postService := service.NewPostService(postRepo, tagRepo, kafkaProducer, aiClient)
	tagService := service.NewTagService(tagRepo)

	srv := handler.NewDefaultServer(graph.NewExecutableSchema(graph.Config{
		Resolvers: &graph.Resolver{
			PostService: postService,
			TagService:  tagService,
		},
	}))

	authMiddleware := middleware.AuthMiddleware(cfg)
	metricsMiddleware := middleware.MetricsMiddleware
	corsMiddleware := middleware.CORS(middleware.CORSConfig{
		AllowedOrigins: cfg.CORSOrigins,
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type", "Apollo-Require-Preflight"},
		MaxAgeSeconds:  86400,
	})

	mux := http.NewServeMux()
	mux.Handle("/query", corsMiddleware(metricsMiddleware(authMiddleware(srv))))
	mux.Handle("/", playground.Handler("GraphQL playground", "/query"))
	mux.Handle("/metrics", promhttp.Handler())

	healthChecker := health.NewChecker(2 * time.Second)
	healthChecker.Register("redis", func(ctx context.Context) error {
		return redisClient.Ping(ctx).Err()
	})
	healthChecker.Register("mongo", func(ctx context.Context) error {
		return mongoClient.Ping(ctx, readpref.Primary())
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
