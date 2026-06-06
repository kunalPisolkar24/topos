package repository

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain/mocks"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/infrastructure/cache"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.mongodb.org/mongo-driver/mongo"
)

func newTestRedis() (*miniredis.Miniredis, *redis.Client) {
	mr, err := miniredis.Run()
	if err != nil {
		panic(err)
	}

	client := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	return mr, client
}

func TestCachedPostRepo_FindByID(t *testing.T) {
	mr, rdb := newTestRedis()
	defer mr.Close()

	ctx := context.Background()
	postID := "post123"
	expectedPost := &domain.Post{ID: postID, Title: "Cached Title"}

	t.Run("CacheHit", func(t *testing.T) {
		data, _ := json.Marshal(expectedPost)
		_ = mr.Set("post:"+postID, string(data))

		fallbackMock := new(mocks.PostRepository)
		repo := NewCachedPostRepository(fallbackMock, cache.NewRedisCache(rdb))

		got, err := repo.FindByID(ctx, postID)

		assert.NoError(t, err)
		assert.Equal(t, expectedPost.ID, got.ID)
		assert.Equal(t, expectedPost.Title, got.Title)
		
		fallbackMock.AssertNotCalled(t, "FindByID")
	})

	t.Run("CacheMiss_DatabaseHit_SetsCache", func(t *testing.T) {
		mr.FlushAll()

		fallbackMock := new(mocks.PostRepository)
		fallbackMock.On("FindByID", mock.Anything, postID).Return(expectedPost, nil)

		repo := NewCachedPostRepository(fallbackMock, cache.NewRedisCache(rdb))

		got, err := repo.FindByID(ctx, postID)

		assert.NoError(t, err)
		assert.Equal(t, expectedPost.ID, got.ID)

		// Verify Cache was set
		inCache, err := mr.Get("post:" + postID)
		assert.NoError(t, err)
		assert.Contains(t, inCache, "Cached Title")

		fallbackMock.AssertExpectations(t)
	})

	t.Run("CacheMiss_NotFound_ReturnsErrNoDocuments", func(t *testing.T) {
		mr.FlushAll()

		fallbackMock := new(mocks.PostRepository)
		fallbackMock.On("FindByID", mock.Anything, postID).Return(nil, mongo.ErrNoDocuments)

		repo := NewCachedPostRepository(fallbackMock, cache.NewRedisCache(rdb))

		got, err := repo.FindByID(ctx, postID)

		assert.Nil(t, got)
		assert.True(t, errors.Is(err, mongo.ErrNoDocuments))

		cached, getErr := mr.Get("post:" + postID)
		assert.NoError(t, getErr)
		assert.Equal(t, "NF", cached)

		fallbackMock.AssertExpectations(t)
	})

	t.Run("CacheHit_NotFoundMarker_ReturnsErrNoDocuments", func(t *testing.T) {
		mr.FlushAll()
		_ = mr.Set("post:"+postID, "NF")

		fallbackMock := new(mocks.PostRepository)
		repo := NewCachedPostRepository(fallbackMock, cache.NewRedisCache(rdb))

		got, err := repo.FindByID(ctx, postID)

		assert.Nil(t, got)
		assert.True(t, errors.Is(err, mongo.ErrNoDocuments))
		fallbackMock.AssertNotCalled(t, "FindByID")
	})

	t.Run("CacheMiss_FallbackReturnsNilNil_ReturnsErrNoDocuments", func(t *testing.T) {
		mr.FlushAll()

		fallbackMock := new(mocks.PostRepository)
		fallbackMock.On("FindByID", mock.Anything, postID).Return(nil, nil)

		repo := NewCachedPostRepository(fallbackMock, cache.NewRedisCache(rdb))

		got, err := repo.FindByID(ctx, postID)

		assert.Nil(t, got)
		assert.True(t, errors.Is(err, mongo.ErrNoDocuments))

		fallbackMock.AssertExpectations(t)
	})
}

func TestCachedPostRepo_Update(t *testing.T) {
	mr, rdb := newTestRedis()
	defer mr.Close()

	ctx := context.Background()
	postID := "post123"
	
	// Pre-populate cache to verify deletion
	_ = mr.Set("post:"+postID, "old data")

	updatedPost := &domain.Post{ID: postID, Title: "New Title"}

	fallbackMock := new(mocks.PostRepository)
	fallbackMock.On("Update", mock.Anything, postID, updatedPost).Return(updatedPost, nil)

	repo := NewCachedPostRepository(fallbackMock, cache.NewRedisCache(rdb))

	got, err := repo.Update(ctx, postID, updatedPost)

	assert.NoError(t, err)
	assert.Equal(t, "New Title", got.Title)

	// Verify Cache was deleted (Invalidated)
	exists := mr.Exists("post:" + postID)
	assert.False(t, exists)

	fallbackMock.AssertExpectations(t)
}

func TestCachedPostRepo_FindAll_Cache(t *testing.T) {
	mr, rdb := newTestRedis()
	defer mr.Close()

	ctx := context.Background()
	page, limit := 1, 10
	cacheKey := "posts:all:1:10"

	mockResult := &domain.PaginatedPosts{
		Posts: []*domain.Post{{ID: "1"}},
		Page:  1,
	}

	t.Run("CacheMiss", func(t *testing.T) {
		fallbackMock := new(mocks.PostRepository)
		fallbackMock.On("FindAll", mock.Anything, page, limit).Return(mockResult, nil)

		repo := NewCachedPostRepository(fallbackMock, cache.NewRedisCache(rdb))
		got, err := repo.FindAll(ctx, page, limit)

		assert.NoError(t, err)
		assert.Equal(t, 1, len(got.Posts))

		assert.True(t, mr.Exists(cacheKey))
	})
}

func TestCachedPostRepo_FindAll_NilFallback_DoesNotPanic(t *testing.T) {
	mr, rdb := newTestRedis()
	defer mr.Close()

	ctx := context.Background()
	page, limit := 1, 10
	cacheKey := "posts:all:1:10"

	fallbackMock := new(mocks.PostRepository)
	fallbackMock.On("FindAll", mock.Anything, page, limit).Return(nil, nil)

	repo := NewCachedPostRepository(fallbackMock, cache.NewRedisCache(rdb))
	got, err := repo.FindAll(ctx, page, limit)

	assert.NoError(t, err)
	assert.Nil(t, got)
	assert.False(t, mr.Exists(cacheKey))
}

func seedListCaches(mr *miniredis.Miniredis) {
	mr.Set("posts:all:1:6", "all1")
	mr.Set("posts:all:2:6", "all2")
	mr.Set("posts:author:u1:1:3", "u1p1")
	mr.Set("posts:author:u1:2:3", "u1p2")
	mr.Set("posts:author:u2:1:3", "u2p1")
	mr.Set("posts:tag:go:1:3", "tag-go")
	mr.Set("posts:tag:web:1:3", "tag-web")
}

func TestCachedPostRepo_Create_InvalidatesLists(t *testing.T) {
	mr, rdb := newTestRedis()
	defer mr.Close()

	ctx := context.Background()
	seedListCaches(mr)

	post := &domain.Post{
		ID:       "p1",
		AuthorID: "u1",
		Tags:     []string{"go", "web"},
	}

	fallbackMock := new(mocks.PostRepository)
	fallbackMock.On("Create", mock.Anything, post).Return(post, nil)

	repo := NewCachedPostRepository(fallbackMock, cache.NewRedisCache(rdb))
	_, err := repo.Create(ctx, post)

	assert.NoError(t, err)
	fallbackMock.AssertExpectations(t)

	assert.False(t, mr.Exists("posts:all:1:6"))
	assert.False(t, mr.Exists("posts:all:2:6"))
	assert.False(t, mr.Exists("posts:author:u1:1:3"))
	assert.False(t, mr.Exists("posts:author:u1:2:3"))
	assert.False(t, mr.Exists("posts:tag:go:1:3"))
	assert.False(t, mr.Exists("posts:tag:web:1:3"))
	assert.True(t, mr.Exists("posts:author:u2:1:3"))
}

func TestCachedPostRepo_Update_InvalidatesLists(t *testing.T) {
	mr, rdb := newTestRedis()
	defer mr.Close()

	ctx := context.Background()
	seedListCaches(mr)
	mr.Set("post:p1", "old")

	post := &domain.Post{
		ID:       "p1",
		AuthorID: "u1",
		Tags:     []string{"go"},
	}

	fallbackMock := new(mocks.PostRepository)
	fallbackMock.On("Update", mock.Anything, "p1", post).Return(post, nil)

	repo := NewCachedPostRepository(fallbackMock, cache.NewRedisCache(rdb))
	_, err := repo.Update(ctx, "p1", post)

	assert.NoError(t, err)
	fallbackMock.AssertExpectations(t)

	assert.False(t, mr.Exists("post:p1"))
	assert.False(t, mr.Exists("posts:all:1:6"))
	assert.False(t, mr.Exists("posts:all:2:6"))
	assert.False(t, mr.Exists("posts:author:u1:1:3"))
	assert.False(t, mr.Exists("posts:tag:go:1:3"))
	assert.True(t, mr.Exists("posts:tag:web:1:3"))
	assert.True(t, mr.Exists("posts:author:u2:1:3"))
}

func TestCachedPostRepo_Update_TagDeduplication(t *testing.T) {
	mr, rdb := newTestRedis()
	defer mr.Close()

	ctx := context.Background()
	mr.Set("posts:tag:go:1:3", "tag-go")
	mr.Set("posts:tag:web:1:3", "tag-web")
	mr.Set("posts:all:1:6", "all1")

	post := &domain.Post{
		ID:       "p1",
		AuthorID: "u1",
		Tags:     []string{"go", "go", ""},
	}

	fallbackMock := new(mocks.PostRepository)
	fallbackMock.On("Update", mock.Anything, "p1", post).Return(post, nil)

	repo := NewCachedPostRepository(fallbackMock, cache.NewRedisCache(rdb))
	_, err := repo.Update(ctx, "p1", post)

	assert.NoError(t, err)
	assert.False(t, mr.Exists("posts:tag:go:1:3"))
	assert.True(t, mr.Exists("posts:tag:web:1:3"))
	assert.False(t, mr.Exists("posts:all:1:6"))
}

func TestCachedPostRepo_Delete_InvalidatesLists(t *testing.T) {
	mr, rdb := newTestRedis()
	defer mr.Close()

	ctx := context.Background()
	seedListCaches(mr)
	mr.Set("post:p1", "stale")

	existing := &domain.Post{
		ID:       "p1",
		AuthorID: "u1",
		Tags:     []string{"go", "web"},
	}

	fallbackMock := new(mocks.PostRepository)
	fallbackMock.On("FindByID", mock.Anything, "p1").Return(existing, nil)
	fallbackMock.On("Delete", mock.Anything, "p1").Return(nil)

	repo := NewCachedPostRepository(fallbackMock, cache.NewRedisCache(rdb))
	err := repo.Delete(ctx, "p1")

	assert.NoError(t, err)
	fallbackMock.AssertExpectations(t)

	assert.False(t, mr.Exists("post:p1"))
	assert.False(t, mr.Exists("posts:all:1:6"))
	assert.False(t, mr.Exists("posts:all:2:6"))
	assert.False(t, mr.Exists("posts:author:u1:1:3"))
	assert.False(t, mr.Exists("posts:author:u1:2:3"))
	assert.False(t, mr.Exists("posts:tag:go:1:3"))
	assert.False(t, mr.Exists("posts:tag:web:1:3"))
	assert.True(t, mr.Exists("posts:author:u2:1:3"))
}

func TestCachedPostRepo_Delete_NotFound_IsNoOp(t *testing.T) {
	mr, rdb := newTestRedis()
	defer mr.Close()

	ctx := context.Background()
	mr.Set("posts:author:u2:1:3", "u2p1")
	mr.Set("posts:all:1:6", "all1")

	fallbackMock := new(mocks.PostRepository)
	fallbackMock.On("FindByID", mock.Anything, "missing").Return(nil, mongo.ErrNoDocuments)

	repo := NewCachedPostRepository(fallbackMock, cache.NewRedisCache(rdb))
	err := repo.Delete(ctx, "missing")

	assert.True(t, errors.Is(err, mongo.ErrNoDocuments))
	fallbackMock.AssertNotCalled(t, "Delete")
	fallbackMock.AssertExpectations(t)

	assert.True(t, mr.Exists("posts:author:u2:1:3"))
	assert.True(t, mr.Exists("posts:all:1:6"))
}

func TestCachedPostRepo_Delete_FindByIDError_Propagates(t *testing.T) {
	mr, rdb := newTestRedis()
	defer mr.Close()

	ctx := context.Background()

	fallbackMock := new(mocks.PostRepository)
	fallbackMock.On("FindByID", mock.Anything, "p1").Return(nil, errors.New("db down"))

	repo := NewCachedPostRepository(fallbackMock, cache.NewRedisCache(rdb))
	err := repo.Delete(ctx, "p1")

	assert.Error(t, err)
	fallbackMock.AssertNotCalled(t, "Delete")
	fallbackMock.AssertExpectations(t)
}