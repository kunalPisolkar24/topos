package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/monitoring"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/sync/singleflight"
)

const (
	entityTTL      = 1 * time.Hour
	listTTL        = 30 * time.Second
	notFoundTTL    = 1 * time.Minute
	notFoundMarker = "NF"
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
	r.invalidate(ctx, id)
	return updatedPost, nil
}

func (r *cachedPostRepo) UpdateSummary(ctx context.Context, id string, summary string, status string) error {
	err := r.fallback.UpdateSummary(ctx, id, summary, status)
	if err != nil {
		return err
	}
	r.invalidate(ctx, id)
	return nil
}

func (r *cachedPostRepo) Delete(ctx context.Context, id string) error {
	err := r.fallback.Delete(ctx, id)
	if err != nil {
		return err
	}
	r.invalidate(ctx, id)
	return nil
}

func (r *cachedPostRepo) FindByID(ctx context.Context, id string) (*domain.Post, error) {
	key := fmt.Sprintf("post:%s", id)

	val, err := r.redis.Get(ctx, key).Result()
	if err == nil {
		monitoring.RecordCacheHit()
		if val == notFoundMarker {
			return nil, mongo.ErrNoDocuments
		}
		var post domain.Post
		if jsonErr := json.Unmarshal([]byte(val), &post); jsonErr == nil {
			return &post, nil
		}
	} else if err != redis.Nil {
		monitoring.RecordCacheMiss()
	}

	ch := r.sf.DoChan(key, func() (interface{}, error) {
		bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return r.findByIDInternal(bgCtx, key, id)
	})

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case res := <-ch:
		if res.Err != nil {
			return nil, res.Err
		}
		if res.Val == nil {
			return nil, mongo.ErrNoDocuments
		}
		return res.Val.(*domain.Post), nil
	}
}

func (r *cachedPostRepo) findByIDInternal(ctx context.Context, key, id string) (*domain.Post, error) {
	post, err := r.fallback.FindByID(ctx, id)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			if setErr := r.redis.Set(context.Background(), key, notFoundMarker, notFoundTTL).Err(); setErr == nil {
				monitoring.RecordCacheSet()
			}
			return nil, nil
		}
		return nil, err
	}

	if data, marshalErr := json.Marshal(post); marshalErr == nil {
		if setErr := r.redis.Set(context.Background(), key, data, entityTTL).Err(); setErr == nil {
			monitoring.RecordCacheSet()
		}
	}

	return post, nil
}

func (r *cachedPostRepo) FindAll(ctx context.Context, page, limit int) (*domain.PaginatedPosts, error) {
	key := fmt.Sprintf("posts:all:%d:%d", page, limit)
	return r.findPaginated(ctx, key, func(fctx context.Context) (*domain.PaginatedPosts, error) {
		return r.fallback.FindAll(fctx, page, limit)
	})
}

func (r *cachedPostRepo) FindByAuthor(ctx context.Context, authorID string, page, limit int) (*domain.PaginatedPosts, error) {
	key := fmt.Sprintf("posts:author:%s:%d:%d", authorID, page, limit)
	return r.findPaginated(ctx, key, func(fctx context.Context) (*domain.PaginatedPosts, error) {
		return r.fallback.FindByAuthor(fctx, authorID, page, limit)
	})
}

func (r *cachedPostRepo) FindByTag(ctx context.Context, tag string, page, limit int) (*domain.PaginatedPosts, error) {
	key := fmt.Sprintf("posts:tag:%s:%d:%d", tag, page, limit)
	return r.findPaginated(ctx, key, func(fctx context.Context) (*domain.PaginatedPosts, error) {
		return r.fallback.FindByTag(fctx, tag, page, limit)
	})
}

func (r *cachedPostRepo) findPaginated(ctx context.Context, key string, fetchFn func(context.Context) (*domain.PaginatedPosts, error)) (*domain.PaginatedPosts, error) {
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

	ch := r.sf.DoChan(key, func() (interface{}, error) {
		bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		pp, err := fetchFn(bgCtx)
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

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case res := <-ch:
		if res.Err != nil {
			return nil, res.Err
		}
		return res.Val.(*domain.PaginatedPosts), nil
	}
}

func (r *cachedPostRepo) invalidate(ctx context.Context, id string) {
	key := fmt.Sprintf("post:%s", id)
	r.sf.Forget(key)
	if err := r.redis.Del(ctx, key).Err(); err == nil {
		monitoring.RecordCacheDel()
	}
}