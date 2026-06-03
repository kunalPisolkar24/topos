package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/monitoring"
	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/sync/singleflight"
)

const (
	entityTTL      = 5 * time.Minute
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
	created, err := r.fallback.Create(ctx, post)
	if err != nil {
		return nil, err
	}
	r.invalidateAllLists(ctx)
	r.invalidateAuthorAndTagLists(ctx, created.AuthorID, created.Tags)
	return created, nil
}

func (r *cachedPostRepo) Update(ctx context.Context, id string, post *domain.Post) (*domain.Post, error) {
	updatedPost, err := r.fallback.Update(ctx, id, post)
	if err != nil {
		return nil, err
	}
	r.invalidate(ctx, id)
	r.invalidateAllLists(ctx)
	r.invalidateAuthorAndTagLists(ctx, updatedPost.AuthorID, updatedPost.Tags)
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
	existing, err := r.fallback.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return mongo.ErrNoDocuments
	}

	if err := r.fallback.Delete(ctx, id); err != nil {
		return err
	}
	r.invalidate(ctx, id)
	r.invalidateAllLists(ctx)
	r.invalidateAuthorAndTagLists(ctx, existing.AuthorID, existing.Tags)
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
		post, ok := res.Val.(*domain.Post)
		if !ok || post == nil {
			return nil, mongo.ErrNoDocuments
		}
		return post, nil
	}
}

func (r *cachedPostRepo) findByIDInternal(ctx context.Context, key, id string) (*domain.Post, error) {
	post, err := r.fallback.FindByID(ctx, id)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			if setErr := r.redis.Set(context.Background(), key, notFoundMarker, notFoundTTL).Err(); setErr == nil {
				monitoring.RecordCacheSet()
			}
			return nil, mongo.ErrNoDocuments
		}
		return nil, err
	}

	if post == nil {
		return nil, mongo.ErrNoDocuments
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
	if err := r.redis.Del(ctx, key).Err(); err != nil {
		logger.Error("Cache invalidation failed, continuing", "key", key, "error", err)
		return
	}
	monitoring.RecordCacheDel()
}

func (r *cachedPostRepo) deleteByPattern(ctx context.Context, pattern string) {
	keys, err := r.scanKeys(ctx, pattern)
	if err != nil {
		logger.Error("Cache scan failed for invalidation, continuing", "pattern", pattern, "error", err)
		return
	}
	if len(keys) == 0 {
		return
	}
	if err := r.redis.Del(ctx, keys...).Err(); err != nil {
		logger.Error("Cache invalidation by pattern failed, continuing", "pattern", pattern, "error", err)
		return
	}
	monitoring.RecordCacheDel()
}

func (r *cachedPostRepo) scanKeys(ctx context.Context, pattern string) ([]string, error) {
	var (
		cursor  uint64
		keys    []string
		batch   []string
		iterErr error
	)
	for {
		batch, cursor, iterErr = r.redis.Scan(ctx, cursor, pattern, 100).Result()
		if iterErr != nil {
			return nil, fmt.Errorf("failed to scan keys for pattern %q: %w", pattern, iterErr)
		}
		keys = append(keys, batch...)
		if cursor == 0 {
			break
		}
	}
	return keys, nil
}

func (r *cachedPostRepo) invalidateAllLists(ctx context.Context) {
	r.deleteByPattern(ctx, "posts:all:*")
}

func (r *cachedPostRepo) invalidateAuthorAndTagLists(ctx context.Context, authorID string, tags []string) {
	r.deleteByPattern(ctx, fmt.Sprintf("posts:author:%s:*", authorID))
	seen := make(map[string]struct{}, len(tags))
	for _, tag := range tags {
		if tag == "" {
			continue
		}
		if _, ok := seen[tag]; ok {
			continue
		}
		seen[tag] = struct{}{}
		r.deleteByPattern(ctx, fmt.Sprintf("posts:tag:%s:*", tag))
	}
}
