package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/config"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/db"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/ai"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/cache"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/repository"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/service"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/worker"
	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
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

	aiClient, err := ai.NewAIClient(cfg.AIServiceURL)
	if err != nil {
		logger.Error("Failed to connect to AI Service", "error", err)
		os.Exit(1)
	}

	database := mongoClient.Database(cfg.DbName)
	postRepo := repository.NewCachedPostRepository(repository.NewMongoPostRepository(database), redisClient)
	tagRepo := repository.NewMongoTagRepository(database)

	postService := service.NewPostService(postRepo, tagRepo, nil, aiClient)

	w := worker.NewWorker(cfg.KafkaBrokers, cfg.KafkaTopic, postService, aiClient)
	defer w.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go w.Start(ctx)

	logger.Info("Content Worker started")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down worker...")
	cancel()
}