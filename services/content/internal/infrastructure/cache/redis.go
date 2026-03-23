package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/config"
)

// NewRedisClientAuto creates a Redis client based on the config mode.
// In "sentinel" mode, it connects via Redis Sentinel for HA.
// In "standalone" mode, it connects directly to a single Redis instance.
func NewRedisClientAuto(cfg *config.Config) (*redis.Client, error) {
	switch cfg.RedisMode {
	case "sentinel":
		return NewRedisClient(cfg.RedisMasterName, cfg.RedisAddrs)
	default:
		return NewRedisClientFromURL(cfg.RedisURL)
	}
}

// NewRedisClient connects via Redis Sentinel (production).
func NewRedisClient(masterName string, sentinelAddrs []string) (*redis.Client, error) {
	rdb := redis.NewFailoverClient(&redis.FailoverOptions{
		MasterName:    masterName,
		SentinelAddrs: sentinelAddrs,
		ReadTimeout:   3 * time.Second,
		WriteTimeout:  3 * time.Second,
		PoolSize:      10,
	})

	if err := ping(rdb); err != nil {
		return nil, fmt.Errorf("redis sentinel ping: %w", err)
	}

	return rdb, nil
}

// NewRedisClientFromURL connects to a standalone Redis instance (local dev).
func NewRedisClientFromURL(redisURL string) (*redis.Client, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("redis parse url: %w", err)
	}

	opts.ReadTimeout = 3 * time.Second
	opts.WriteTimeout = 3 * time.Second
	opts.PoolSize = 10

	rdb := redis.NewClient(opts)

	if err := ping(rdb); err != nil {
		return nil, fmt.Errorf("redis standalone ping: %w", err)
	}

	return rdb, nil
}

func ping(rdb *redis.Client) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return rdb.Ping(ctx).Err()
}