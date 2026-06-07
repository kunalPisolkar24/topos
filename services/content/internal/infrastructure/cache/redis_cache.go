package cache

import (
	"context"
	"errors"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/redis/go-redis/v9"
)

type RedisCache struct {
	client *redis.Client
}

func NewRedisCache(client *redis.Client) domain.Cache {
	return &RedisCache{client: client}
}

func (c *RedisCache) Get(ctx context.Context, key string) (string, error) {
	val, err := c.client.Get(ctx, key).Result()
	if errors.Is(err, redis.Nil) {
		return "", domain.ErrCacheMiss
	}
	return val, err
}

func (c *RedisCache) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	return c.client.Set(ctx, key, value, ttl).Err()
}

func (c *RedisCache) Del(ctx context.Context, keys ...string) error {
	return c.client.Del(ctx, keys...).Err()
}

func (c *RedisCache) Scan(ctx context.Context, pattern string) ([]string, error) {
	var (
		cursor  uint64
		keys    []string
		batch   []string
		iterErr error
	)
	for {
		batch, cursor, iterErr = c.client.Scan(ctx, cursor, pattern, 100).Result()
		if iterErr != nil {
			return nil, iterErr
		}
		keys = append(keys, batch...)
		if cursor == 0 {
			break
		}
	}
	return keys, nil
}
