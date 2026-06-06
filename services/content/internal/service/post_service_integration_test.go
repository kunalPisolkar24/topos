//go:build integration

package service

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/repository"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/testhelpers"
	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	logger.Init()
}

func setupServiceWithMongo(t *testing.T) (*PostService, func()) {
	t.Helper()

	db, cleanup := testhelpers.SetupMongoDB(t)

	postRepo := repository.NewMongoPostRepository(db)
	tagRepo := repository.NewMongoTagRepository(db)

	svc := NewPostService(postRepo, tagRepo, testhelpers.NoopEventProducer{}, nil)

	return svc, cleanup
}

func TestPostService_Integration_CreateAndGet(t *testing.T) {
	svc, cleanup := setupServiceWithMongo(t)
	defer cleanup()
	ctx := context.Background()

	t.Run("CreateAndFindByID", func(t *testing.T) {
		created, err := svc.CreatePost(ctx, "Integration Title", "Integration Body", "user1", []string{"integration"}, nil, nil)
		require.NoError(t, err)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, "Integration Title", created.Title)
		assert.Equal(t, "user1", created.AuthorID)
		assert.Contains(t, created.Tags, "integration")
		assert.NotEmpty(t, created.Slug)

		got, err := svc.GetPost(ctx, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, got.ID)
		assert.Equal(t, "Integration Title", got.Title)
		assert.Equal(t, created.Slug, got.Slug)
	})

	t.Run("CreateWithSummary", func(t *testing.T) {
		summary := "Provided summary"
		created, err := svc.CreatePost(ctx, "With Summary", "Body", "user2", nil, nil, &summary)
		require.NoError(t, err)
		assert.Equal(t, "Provided summary", created.Summary)
		assert.Equal(t, "COMPLETED", string(created.SummaryStatus))
	})

	t.Run("CreateWithImage", func(t *testing.T) {
		img := "https://example.com/img.png"
		created, err := svc.CreatePost(ctx, "With Image", "Body", "user3", nil, &img, nil)
		require.NoError(t, err)
		assert.Equal(t, img, *created.ImageUrl)
	})
}

func TestPostService_Integration_Update(t *testing.T) {
	svc, cleanup := setupServiceWithMongo(t)
	defer cleanup()
	ctx := context.Background()

	created, err := svc.CreatePost(ctx, "Original Title", "Original Body", "user1", []string{"original"}, nil, nil)
	require.NoError(t, err)

	t.Run("UpdateTitleAndBody", func(t *testing.T) {
		newTitle := "Updated Title"
		newBody := "Updated Body"
		updated, err := svc.UpdatePost(ctx, created.ID, "user1", &newTitle, &newBody, nil, nil)
		require.NoError(t, err)
		assert.Equal(t, "Updated Title", updated.Title)
		assert.Equal(t, "Updated Body", updated.Body)

		got, _ := svc.GetPost(ctx, created.ID)
		assert.Equal(t, "Updated Title", got.Title)
	})

	t.Run("UpdateTags", func(t *testing.T) {
		tags := []string{"updated", "tags"}
		updated, err := svc.UpdatePost(ctx, created.ID, "user1", nil, nil, tags, nil)
		require.NoError(t, err)
		assert.Equal(t, tags, updated.Tags)
	})

	t.Run("Forbidden", func(t *testing.T) {
		newTitle := "Hacked"
		_, err := svc.UpdatePost(ctx, created.ID, "other-user", &newTitle, nil, nil, nil)
		require.Error(t, err)
		assert.True(t, errors.Is(err, domain.ErrForbidden))
	})

	t.Run("TitleChangeResetsSummary", func(t *testing.T) {
		newTitle := "Title After Summary Reset"
		updated, err := svc.UpdatePost(ctx, created.ID, "user1", &newTitle, nil, nil, nil)
		require.NoError(t, err)
		assert.Equal(t, "", updated.Summary)
		assert.Equal(t, "PENDING", string(updated.SummaryStatus))
	})
}

func TestPostService_Integration_Delete(t *testing.T) {
	svc, cleanup := setupServiceWithMongo(t)
	defer cleanup()
	ctx := context.Background()

	created, err := svc.CreatePost(ctx, "To Delete", "Body", "user1", nil, nil, nil)
	require.NoError(t, err)

	t.Run("Success", func(t *testing.T) {
		err := svc.DeletePost(ctx, created.ID, "user1")
		require.NoError(t, err)

		_, err = svc.GetPost(ctx, created.ID)
		require.Error(t, err)
	})

	t.Run("Forbidden", func(t *testing.T) {
		created2, _ := svc.CreatePost(ctx, "Another", "Body", "user1", nil, nil, nil)

		err := svc.DeletePost(ctx, created2.ID, "other-user")
		require.Error(t, err)
		assert.True(t, errors.Is(err, domain.ErrForbidden))
	})
}

func TestPostService_Integration_List(t *testing.T) {
	svc, cleanup := setupServiceWithMongo(t)
	defer cleanup()
	ctx := context.Background()

	for i := 0; i < 5; i++ {
		title := fmt.Sprintf("Post Title %d", i)
		_, err := svc.CreatePost(ctx, title, "Body", "author1", []string{"list"}, nil, nil)
		require.NoError(t, err)
	}

	t.Run("GetPosts", func(t *testing.T) {
		result, err := svc.GetPosts(ctx, 1, 3)
		require.NoError(t, err)
		assert.Len(t, result.Posts, 3)
		assert.Equal(t, 2, result.TotalPages)
		assert.Equal(t, int64(5), result.TotalPosts)
	})

	t.Run("GetPosts_EmptyResult", func(t *testing.T) {
		result, err := svc.GetPosts(ctx, 10, 10)
		require.NoError(t, err)
		assert.Empty(t, result.Posts)
	})
}

func TestPostService_Integration_GetPostsByAuthor(t *testing.T) {
	svc, cleanup := setupServiceWithMongo(t)
	defer cleanup()
	ctx := context.Background()

	_, _ = svc.CreatePost(ctx, "Author A Post 1", "Body", "author-a", nil, nil, nil)
	_, _ = svc.CreatePost(ctx, "Author A Post 2", "Body", "author-a", nil, nil, nil)
	_, _ = svc.CreatePost(ctx, "Author B Post 1", "Body", "author-b", nil, nil, nil)

	t.Run("AuthorWithPosts", func(t *testing.T) {
		result, err := svc.GetPostsByAuthor(ctx, "author-a", 1, 10)
		require.NoError(t, err)
		assert.Len(t, result.Posts, 2)
	})

	t.Run("AuthorWithNoPosts", func(t *testing.T) {
		result, err := svc.GetPostsByAuthor(ctx, "nonexistent", 1, 10)
		require.NoError(t, err)
		assert.Empty(t, result.Posts)
	})
}

func TestPostService_Integration_GetPostsByTag(t *testing.T) {
	svc, cleanup := setupServiceWithMongo(t)
	defer cleanup()
	ctx := context.Background()

	_, _ = svc.CreatePost(ctx, "Go Post", "Body", "user1", []string{"golang"}, nil, nil)
	_, _ = svc.CreatePost(ctx, "Web Post", "Body", "user1", []string{"web"}, nil, nil)
	_, _ = svc.CreatePost(ctx, "Full Stack Post", "Body", "user1", []string{"golang", "web"}, nil, nil)

	t.Run("TagWithPosts", func(t *testing.T) {
		result, err := svc.GetPostsByTag(ctx, "golang", 1, 10)
		require.NoError(t, err)
		assert.Len(t, result.Posts, 2)
	})

	t.Run("TagWithNoPosts", func(t *testing.T) {
		result, err := svc.GetPostsByTag(ctx, "nonexistent", 1, 10)
		require.NoError(t, err)
		assert.Empty(t, result.Posts)
	})
}

func TestPostService_Integration_DuplicateSlugRetry(t *testing.T) {
	svc, cleanup := setupServiceWithMongo(t)
	defer cleanup()
	ctx := context.Background()

	first, err := svc.CreatePost(ctx, "Same Title", "Body", "user1", nil, nil, nil)
	require.NoError(t, err)
	assert.NotEmpty(t, first.ID)

	// Second post with same title gets same slug; service should retry
	time.Sleep(1100 * time.Millisecond)
	second, err := svc.CreatePost(ctx, "Same Title", "Body", "user1", nil, nil, nil)
	require.NoError(t, err)
	assert.NotEmpty(t, second.ID)
	assert.NotEqual(t, first.ID, second.ID)
}

func TestPostService_Integration_EmptyAndEdgeCases(t *testing.T) {
	svc, cleanup := setupServiceWithMongo(t)
	defer cleanup()
	ctx := context.Background()

	t.Run("GetNonExistent", func(t *testing.T) {
		_, err := svc.GetPost(ctx, "000000000000000000000000")
		require.Error(t, err)
	})

	t.Run("DeleteNonExistent", func(t *testing.T) {
		err := svc.DeletePost(ctx, "000000000000000000000000", "user1")
		require.Error(t, err)
	})

	t.Run("EmptyTagsSlice", func(t *testing.T) {
		created, err := svc.CreatePost(ctx, "No Tags", "Body", "user1", []string{}, nil, nil)
		require.NoError(t, err)
		assert.NotEmpty(t, created.ID)
	})
}
