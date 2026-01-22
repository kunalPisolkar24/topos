package main

import (
	"context"
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
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/ai"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/cache"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/messaging"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/middleware"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/repository"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/service"
	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	logger.Init()
	cfg := config.LoadConfig()

	mongoClient, err := db.Connect(cfg.MongoURI)
	if err != nil {
		logger.Error("Failed to connect to MongoDB", "error", err)
		os.Exit(1)
	}
	defer func() {
		if err = mongoClient.Disconnect(context.Background()); err != nil {
			logger.Error("Failed to disconnect MongoDB", "error", err)
		}
	}()

	redisClient, err := cache.NewRedisClient(cfg.RedisMasterName, cfg.RedisAddrs)
	if err != nil {
		logger.Error("Failed to connect to Redis Sentinel", "error", err)
		os.Exit(1)
	}
	defer func() {
		if err = redisClient.Close(); err != nil {
			logger.Error("Failed to close Redis client", "error", err)
		}
	}()

	kafkaProducer := messaging.NewKafkaProducer(cfg.KafkaBrokers, cfg.KafkaTopic)
	defer func() {
		if err := kafkaProducer.Close(); err != nil {
			logger.Error("Failed to close Kafka producer", "error", err)
		}
	}()

	aiClient, err := ai.NewAIClient(cfg.AIServiceURL)
	if err != nil {
		logger.Error("Failed to connect to AI Service", "error", err)
		os.Exit(1)
	}

	database := mongoClient.Database(cfg.DbName)

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

	http.Handle("/query", metricsMiddleware(authMiddleware(srv)))
	http.Handle("/", playground.Handler("GraphQL playground", "/query"))
	http.Handle("/metrics", promhttp.Handler())
	http.Handle("/health", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := redisClient.Ping(r.Context()).Err(); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Content Service OK"))
	}))

	logger.Info("Content Service starting", "port", cfg.Port)

	server := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: nil,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("Server failed", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Error("Server forced to shutdown", "error", err)
	}

	logger.Info("Server exited properly")
}