package bootstrap

import (
	"context"
	"fmt"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/config"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/db"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/ai"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/cache"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/messaging"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/repository"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/service"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"
)

type Role string

const (
	RoleServer Role = "server"
	RoleWorker Role = "worker"
)

type Deps struct {
	Role         Role
	MongoClient  *mongo.Client
	RedisClient  *redis.Client
	Cache        domain.Cache
	AIService    domain.AIService
	EventPub     domain.EventPublisher
	EventProd    domain.EventProducer
	PostRepo     domain.PostRepository
	TagRepo      domain.TagRepository
	PostService  *service.PostService
	TagService   *service.TagService
	shutdownFns  []func()
}

func Load(ctx context.Context, role Role, cfg *config.Config) (*Deps, error) {
	mongoClient, err := db.Connect(cfg.MongoURI)
	if err != nil {
		return nil, fmt.Errorf("connect mongo: %w", err)
	}

	redisClient, err := cache.NewRedisClientAuto(cfg)
	if err != nil {
		_ = mongoClient.Disconnect(context.Background())
		return nil, fmt.Errorf("connect redis: %w", err)
	}

	aiClient, err := ai.NewResilientAIClient(cfg.AIServiceURL, cfg.AIRequired, cfg.AIDialTimeout)
	if err != nil {
		_ = redisClient.Close()
		_ = mongoClient.Disconnect(context.Background())
		return nil, fmt.Errorf("connect ai: %w", err)
	}

	database := mongoClient.Database(cfg.DbName)
	if err := db.EnsureIndexes(ctx, database); err != nil {
		_ = aiClient.Close()
		_ = redisClient.Close()
		_ = mongoClient.Disconnect(context.Background())
		return nil, fmt.Errorf("ensure indexes: %w", err)
	}

	cachePort := cache.NewRedisCache(redisClient)
	postRepo := repository.NewCachedPostRepository(repository.NewMongoPostRepository(database), cachePort)
	tagRepo := repository.NewMongoTagRepository(database)

	deps := &Deps{
		Role:        role,
		MongoClient: mongoClient,
		RedisClient: redisClient,
		Cache:       cachePort,
		AIService:   aiClient,
		PostRepo:    postRepo,
		TagRepo:     tagRepo,
	}

	producer := messaging.NewKafkaProducer(cfg.KafkaBrokers, cfg.KafkaTopic)
	deps.EventProd = producer
	deps.EventPub = producer

	deps.PostService = service.NewPostService(deps.PostRepo, deps.TagRepo, deps.EventPub, deps.AIService)
	deps.TagService = service.NewTagService(deps.TagRepo)

	deps.shutdownFns = []func(){
		func() { _ = mongoClient.Disconnect(context.Background()) },
		func() { _ = redisClient.Close() },
		func() { _ = aiClient.Close() },
		func() {
			if deps.EventProd != nil {
				_ = deps.EventProd.Close()
			}
		},
	}

	return deps, nil
}

func (d *Deps) Shutdown() {
	for i := len(d.shutdownFns) - 1; i >= 0; i-- {
		d.shutdownFns[i]()
	}
}
