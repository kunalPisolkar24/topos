package repository

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain/mocks"
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
		repo := NewCachedPostRepository(fallbackMock, rdb)

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

		repo := NewCachedPostRepository(fallbackMock, rdb)

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

		repo := NewCachedPostRepository(fallbackMock, rdb)

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
		repo := NewCachedPostRepository(fallbackMock, rdb)

		got, err := repo.FindByID(ctx, postID)

		assert.Nil(t, got)
		assert.True(t, errors.Is(err, mongo.ErrNoDocuments))
		fallbackMock.AssertNotCalled(t, "FindByID")
	})

	t.Run("CacheMiss_FallbackReturnsNilNil_ReturnsErrNoDocuments", func(t *testing.T) {
		mr.FlushAll()

		fallbackMock := new(mocks.PostRepository)
		fallbackMock.On("FindByID", mock.Anything, postID).Return(nil, nil)

		repo := NewCachedPostRepository(fallbackMock, rdb)

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

	repo := NewCachedPostRepository(fallbackMock, rdb)

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

		repo := NewCachedPostRepository(fallbackMock, rdb)
		got, err := repo.FindAll(ctx, page, limit)

		assert.NoError(t, err)
		assert.Equal(t, 1, len(got.Posts))

		// Check Redis set
		assert.True(t, mr.Exists(cacheKey))
	})
}