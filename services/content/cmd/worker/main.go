package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/config"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/db"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/ai"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/cache"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/repository"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/service"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/worker"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/messaging"
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

	aiClient, err := ai.NewResilientAIClient(cfg.AIServiceURL, cfg.AIRequired, cfg.AIDialTimeout)
	if err != nil {
		logger.Error("Failed to connect to AI Service", "error", err)
		os.Exit(1)
	}

	database := mongoClient.Database(cfg.DbName)
	postRepo := repository.NewCachedPostRepository(repository.NewMongoPostRepository(database), redisClient)
	tagRepo := repository.NewMongoTagRepository(database)

	kafkaProducer := messaging.NewKafkaProducer(cfg.KafkaBrokers, cfg.KafkaTopic)
	defer kafkaProducer.Close()

	postService := service.NewPostService(postRepo, tagRepo, kafkaProducer, aiClient)

	w, err := worker.NewWorker(cfg.KafkaBrokers, cfg.KafkaConsumerGroupID, cfg.KafkaConsumerTopics, cfg.KafkaDLQTopic, postService, aiClient, kafkaProducer)
	if err != nil {
		logger.Error("Failed to initialize worker", "error", err)
		os.Exit(1)
	}
	defer w.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	metricsServer := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: nil,
	}

	http.Handle("/metrics", promhttp.Handler())
	http.Handle("/health", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Worker OK"))
	}))

	go func() {
		logger.Info("Starting Worker Metrics Server", "port", cfg.Port)
		if err := metricsServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("Metrics server failed", "error", err)
			cancel()
		}
	}()

	go w.Start(ctx)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down worker...")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := metricsServer.Shutdown(shutdownCtx); err != nil {
		logger.Error("Metrics server forced to shutdown", "error", err)
	}

	logger.Info("Worker exited properly")
}
