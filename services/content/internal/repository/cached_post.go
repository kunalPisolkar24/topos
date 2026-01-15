package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/monitoring"
	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/singleflight"
)

const (
	entityTTL = 1 * time.Hour
	listTTL   = 30 * time.Second
)

type cachedPostRepo struct {
	fallback domain.PostRepository
	redis    *redis.Client
	sf       singleflight.Group
}

func NewCachedPostRepository(fallback domain.PostRepository, redis *redis.Client) domain.PostRepository {
	return &cachedPostRepo{
		fallback: fallback,
		redis:    redis,
	}
}

func (r *cachedPostRepo) Create(ctx context.Context, post *domain.Post) (*domain.Post, error) {
	return r.fallback.Create(ctx, post)
}

func (r *cachedPostRepo) Update(ctx context.Context, id string, post *domain.Post) (*domain.Post, error) {
	updatedPost, err := r.fallback.Update(ctx, id, post)
	if err != nil {
		return nil, err
	}

	key := fmt.Sprintf("post:%s", id)
	r.sf.Forget(key)
	if err := r.redis.Del(ctx, key).Err(); err == nil {
		monitoring.RecordCacheDel()
	}

	return updatedPost, nil
}

func (r *cachedPostRepo) Delete(ctx context.Context, id string) error {
	err := r.fallback.Delete(ctx, id)
	if err != nil {
		return err
	}

	key := fmt.Sprintf("post:%s", id)
	r.sf.Forget(key)
	if err := r.redis.Del(ctx, key).Err(); err == nil {
		monitoring.RecordCacheDel()
	}

	return nil
}

func (r *cachedPostRepo) FindByID(ctx context.Context, id string) (*domain.Post, error) {
	key := fmt.Sprintf("post:%s", id)

	val, err := r.redis.Get(ctx, key).Result()
	if err == nil {
		monitoring.RecordCacheHit()
		var post domain.Post
		if jsonErr := json.Unmarshal([]byte(val), &post); jsonErr == nil {
			return &post, nil
		}
	} else if err != redis.Nil {
		monitoring.RecordCacheMiss()
	}

	v, err, _ := r.sf.Do(key, func() (interface{}, error) {
		post, err := r.fallback.FindByID(ctx, id)
		if err != nil {
			return nil, err
		}

		if data, marshalErr := json.Marshal(post); marshalErr == nil {
			if err := r.redis.Set(context.Background(), key, data, entityTTL).Err(); err == nil {
				monitoring.RecordCacheSet()
			}
		}

		return post, nil
	})

	if err != nil {
		return nil, err
	}

	return v.(*domain.Post), nil
}

func (r *cachedPostRepo) FindAll(ctx context.Context, page, limit int) (*domain.PaginatedPosts, error) {
	key := fmt.Sprintf("posts:all:%d:%d", page, limit)
	return r.findPaginated(ctx, key, func() (*domain.PaginatedPosts, error) {
		return r.fallback.FindAll(ctx, page, limit)
	})
}

func (r *cachedPostRepo) FindByAuthor(ctx context.Context, authorID string, page, limit int) (*domain.PaginatedPosts, error) {
	key := fmt.Sprintf("posts:author:%s:%d:%d", authorID, page, limit)
	return r.findPaginated(ctx, key, func() (*domain.PaginatedPosts, error) {
		return r.fallback.FindByAuthor(ctx, authorID, page, limit)
	})
}

func (r *cachedPostRepo) FindByTag(ctx context.Context, tag string, page, limit int) (*domain.PaginatedPosts, error) {
	key := fmt.Sprintf("posts:tag:%s:%d:%d", tag, page, limit)
	return r.findPaginated(ctx, key, func() (*domain.PaginatedPosts, error) {
		return r.fallback.FindByTag(ctx, tag, page, limit)
	})
}

func (r *cachedPostRepo) findPaginated(ctx context.Context, key string, fetchFn func() (*domain.PaginatedPosts, error)) (*domain.PaginatedPosts, error) {
	val, err := r.redis.Get(ctx, key).Result()
	if err == nil {
		monitoring.RecordCacheHit()
		var pp domain.PaginatedPosts
		if jsonErr := json.Unmarshal([]byte(val), &pp); jsonErr == nil {
			return &pp, nil
		}
	} else if err != redis.Nil {
		monitoring.RecordCacheMiss()
	}

	v, err, _ := r.sf.Do(key, func() (interface{}, error) {
		pp, err := fetchFn()
		if err != nil {
			return nil, err
		}

		if data, marshalErr := json.Marshal(pp); marshalErr == nil {
			if err := r.redis.Set(context.Background(), key, data, listTTL).Err(); err == nil {
				monitoring.RecordCacheSet()
			}
		}

		return pp, nil
	})

	if err != nil {
		return nil, err
	}

	return v.(*domain.PaginatedPosts), nil
}