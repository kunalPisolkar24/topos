package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/config"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/db"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/health"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/ai"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/cache"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/messaging"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/repository"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/service"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/worker"
	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

func main() {
	logger.Init()
	if err := run(); err != nil {
		logger.Error("Worker terminated with error", "error", err)
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

	postRepo := repository.NewCachedPostRepository(repository.NewMongoPostRepository(database), cache.NewRedisCache(redisClient))
	tagRepo := repository.NewMongoTagRepository(database)

	kafkaProducer := messaging.NewKafkaProducer(cfg.KafkaBrokers, cfg.KafkaTopic)
	defer func() {
		if cErr := kafkaProducer.Close(); cErr != nil {
			logger.Error("Failed to close Kafka producer", "error", cErr)
		}
	}()

	postService := service.NewPostService(postRepo, tagRepo, kafkaProducer, aiClient)

	w, err := worker.NewWorker(cfg.KafkaBrokers, cfg.KafkaConsumerGroupID, cfg.KafkaConsumerTopics, cfg.KafkaDLQTopic, postService, aiClient, kafkaProducer)
	if err != nil {
		return err
	}
	defer w.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())

	healthChecker := health.NewChecker(2 * time.Second)
	healthChecker.Register("mongo", func(ctx context.Context) error {
		return mongoClient.Ping(ctx, readpref.Primary())
	})
	healthChecker.Register("kafka", func(ctx context.Context) error {
		return kafkaProducer.Ping(ctx)
	})
	healthChecker.Register("worker", func(_ context.Context) error {
		return w.Running()
	})
	mux.Handle("/health", healthChecker.Handler())

	metricsServer := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: mux,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		logger.Info("Starting Worker Metrics Server", "port", cfg.Port)
		if err := metricsServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Metrics server failed", "error", err)
			stop <- syscall.SIGTERM
		}
	}()

	go w.Start(ctx)

	<-stop

	logger.Info("Shutting down worker...")
	cancel()

	select {
	case <-w.Done():
	case <-time.After(5 * time.Second):
		logger.Warn("Worker did not stop within timeout")
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := metricsServer.Shutdown(shutdownCtx); err != nil {
		logger.Error("Metrics server forced to shutdown", "error", err)
	}

	logger.Info("Worker exited properly")
	return nil
}
