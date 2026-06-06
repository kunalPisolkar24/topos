package domain

import (
	"context"
	"errors"
	"time"
)

var ErrCacheMiss = errors.New("cache miss")

type Cache interface {
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
	Del(ctx context.Context, keys ...string) error
	Scan(ctx context.Context, pattern string) ([]string, error)
}

type CachePolicy int

const (
	CachePolicyFailClosed CachePolicy = iota
	CachePolicyBestEffort
)
