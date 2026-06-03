package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/config"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/db"
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

	redisClient, err := cache.NewRedisClientAuto(cfg)
	if err != nil {
		logger.Error("Failed to connect to Redis", "mode", cfg.RedisMode, "error", err)
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
		return
	}
	defer func() {
		if err := aiClient.Close(); err != nil {
			logger.Error("Failed to close AI client", "error", err)
		}
	}()

	database := mongoClient.Database(cfg.DbName)
	postRepo := repository.NewCachedPostRepository(repository.NewMongoPostRepository(database), redisClient)
	tagRepo := repository.NewMongoTagRepository(database)

	kafkaProducer := messaging.NewKafkaProducer(cfg.KafkaBrokers, cfg.KafkaTopic)
	defer kafkaProducer.Close()

	postService := service.NewPostService(postRepo, tagRepo, kafkaProducer, aiClient)

	w, err := worker.NewWorker(cfg.KafkaBrokers, cfg.KafkaConsumerGroupID, cfg.KafkaConsumerTopics, cfg.KafkaDLQTopic, postService, aiClient, kafkaProducer)
	if err != nil {
		logger.Error("Failed to initialize worker", "error", err)
		return
	}
	defer w.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.Handle("/health", http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		hctx, hcancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer hcancel()

		if err := mongoClient.Ping(hctx, readpref.Primary()); err != nil {
			logger.Error("Health check failed: MongoDB", "error", err)
			rw.WriteHeader(http.StatusServiceUnavailable)
			fmt.Fprintf(rw, "MongoDB: %s", err)
			return
		}

		if err := w.Health(hctx); err != nil {
			logger.Error("Health check failed: Kafka", "error", err)
			rw.WriteHeader(http.StatusServiceUnavailable)
			fmt.Fprintf(rw, "Kafka: %s", err)
			return
		}

		rw.WriteHeader(http.StatusOK)
		rw.Write([]byte("Worker OK"))
	}))

	metricsServer := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: mux,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		logger.Info("Starting Worker Metrics Server", "port", cfg.Port)
		if err := metricsServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("Metrics server failed", "error", err)
			stop <- syscall.SIGTERM
		}
	}()

	var workerWg sync.WaitGroup
	workerWg.Add(1)
	go func() {
		defer workerWg.Done()
		w.Start(ctx)
	}()

	<-stop

	logger.Info("Shutting down worker...")
	cancel()
	workerWg.Wait()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := metricsServer.Shutdown(shutdownCtx); err != nil {
		logger.Error("Metrics server forced to shutdown", "error", err)
	}

	logger.Info("Worker exited properly")
}
