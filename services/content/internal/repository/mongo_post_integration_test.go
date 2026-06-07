//go:build integration

package repository

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/mongo"
)

func setupPostRepo(t *testing.T) (domain.PostRepository, *mongo.Database, func()) {
	t.Helper()
	db, cleanup := testhelpers.SetupMongoDB(t)
	repo := NewMongoPostRepository(db)
	return repo, db, cleanup
}

func tempPost(overrides ...func(*domain.Post)) *domain.Post {
	now := time.Now().UTC().Truncate(time.Millisecond)
	p := &domain.Post{
		Title:     "Test Post",
		Body:      "Test Body",
		Slug:      "test-post-" + now.Format("150405"),
		AuthorID:  "user1",
		Tags:      []string{"go", "testing"},
		CreatedAt: now,
		UpdatedAt: now,
	}
	for _, o := range overrides {
		o(p)
	}
	return p
}

func TestMongoPostRepo_Create(t *testing.T) {
	repo, _, cleanup := setupPostRepo(t)
	defer cleanup()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		post := tempPost()
		created, err := repo.Create(ctx, post)
		require.NoError(t, err)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, post.Title, created.Title)
	})

	t.Run("EmptyTitle", func(t *testing.T) {
		post := tempPost(func(p *domain.Post) {
			p.Title = ""
			p.Slug = "empty-title"
		})
		created, err := repo.Create(ctx, post)
		require.NoError(t, err)
		assert.NotEmpty(t, created.ID)
	})

	t.Run("WithImageAndSummary", func(t *testing.T) {
		img := "https://example.com/img.jpg"
		post := tempPost(func(p *domain.Post) {
			p.Slug = "with-image"
			p.ImageUrl = &img
			p.Summary = "A summary"
			p.SummaryStatus = domain.PostStatusCompleted
		})
		created, err := repo.Create(ctx, post)
		require.NoError(t, err)
		assert.Equal(t, img, *created.ImageUrl)
		assert.Equal(t, "A summary", created.Summary)
	})

	t.Run("NoTags", func(t *testing.T) {
		post := tempPost(func(p *domain.Post) {
			p.Slug = "no-tags"
			p.Tags = nil
		})
		created, err := repo.Create(ctx, post)
		require.NoError(t, err)
		assert.NotEmpty(t, created.ID)
	})
}

func TestMongoPostRepo_FindByID(t *testing.T) {
	repo, db, cleanup := setupPostRepo(t)
	defer cleanup()
	ctx := context.Background()

	created := createTestPost(t, ctx, repo)

	t.Run("Found", func(t *testing.T) {
		got, err := repo.FindByID(ctx, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, got.ID)
		assert.Equal(t, created.Title, got.Title)
	})

	t.Run("NotFound", func(t *testing.T) {
		_, err := repo.FindByID(ctx, "000000000000000000000000")
		require.Error(t, err)
		assert.True(t, errors.Is(err, domain.ErrNotFound))
	})

	t.Run("InvalidID", func(t *testing.T) {
		_, err := repo.FindByID(ctx, "invalid")
		require.Error(t, err)
		assert.True(t, errors.Is(err, domain.ErrNotFound))
	})

	_ = db
}

func TestMongoPostRepo_FindAll(t *testing.T) {
	repo, _, cleanup := setupPostRepo(t)
	defer cleanup()
	ctx := context.Background()

	t.Run("EmptyCollection", func(t *testing.T) {
		result, err := repo.FindAll(ctx, 1, 10)
		require.NoError(t, err)
		assert.Empty(t, result.Posts)
		assert.Equal(t, 0, result.TotalPages)
		assert.Equal(t, int64(0), result.TotalPosts)
		assert.Equal(t, 1, result.Page)
	})

	for i := 0; i < 5; i++ {
		createTestPost(t, ctx, repo)
	}

	t.Run("ReturnsAllPosts", func(t *testing.T) {
		result, err := repo.FindAll(ctx, 1, 10)
		require.NoError(t, err)
		assert.Len(t, result.Posts, 5)
		assert.Equal(t, 1, result.TotalPages)
		assert.Equal(t, int64(5), result.TotalPosts)
	})

	t.Run("Pagination_Page1", func(t *testing.T) {
		result, err := repo.FindAll(ctx, 1, 2)
		require.NoError(t, err)
		assert.Len(t, result.Posts, 2)
		assert.Equal(t, 3, result.TotalPages)
		assert.Equal(t, int64(5), result.TotalPosts)
	})

	t.Run("Pagination_Page2", func(t *testing.T) {
		result, err := repo.FindAll(ctx, 2, 2)
		require.NoError(t, err)
		assert.Len(t, result.Posts, 2)
		assert.Equal(t, 3, result.TotalPages)
	})

	t.Run("DefaultsPageAndLimit", func(t *testing.T) {
		result, err := repo.FindAll(ctx, 0, 0)
		require.NoError(t, err)
		assert.Len(t, result.Posts, 5)
	})

	t.Run("SortedByCreatedAtDesc", func(t *testing.T) {
		result, err := repo.FindAll(ctx, 1, 10)
		require.NoError(t, err)
		for i := 1; i < len(result.Posts); i++ {
			assert.True(t, result.Posts[i-1].CreatedAt.After(result.Posts[i].CreatedAt) ||
				result.Posts[i-1].CreatedAt.Equal(result.Posts[i].CreatedAt))
		}
	})
}

func TestMongoPostRepo_FindByAuthor(t *testing.T) {
	repo, _, cleanup := setupPostRepo(t)
	defer cleanup()
	ctx := context.Background()

	createTestPost(t, ctx, repo, func(p *domain.Post) {
		p.AuthorID = "author-a"
		p.Slug = "author-a-post-1"
	})
	createTestPost(t, ctx, repo, func(p *domain.Post) {
		p.AuthorID = "author-a"
		p.Slug = "author-a-post-2"
	})
	createTestPost(t, ctx, repo, func(p *domain.Post) {
		p.AuthorID = "author-b"
		p.Slug = "author-b-post-1"
	})

	t.Run("AuthorWithPosts", func(t *testing.T) {
		result, err := repo.FindByAuthor(ctx, "author-a", 1, 10)
		require.NoError(t, err)
		assert.Len(t, result.Posts, 2)
		assert.Equal(t, int64(2), result.TotalPosts)
	})

	t.Run("AuthorWithNoPosts", func(t *testing.T) {
		result, err := repo.FindByAuthor(ctx, "nonexistent", 1, 10)
		require.NoError(t, err)
		assert.Empty(t, result.Posts)
		assert.Equal(t, int64(0), result.TotalPosts)
	})

	t.Run("Pagination", func(t *testing.T) {
		createTestPost(t, ctx, repo, func(p *domain.Post) {
			p.AuthorID = "author-a"
			p.Slug = "author-a-post-3"
		})
		result, err := repo.FindByAuthor(ctx, "author-a", 1, 2)
		require.NoError(t, err)
		assert.Len(t, result.Posts, 2)
		assert.Equal(t, 2, result.TotalPages)
	})
}

func TestMongoPostRepo_FindByTag(t *testing.T) {
	repo, _, cleanup := setupPostRepo(t)
	defer cleanup()
	ctx := context.Background()

	createTestPost(t, ctx, repo, func(p *domain.Post) {
		p.Tags = []string{"golang"}
		p.Slug = "golang-post"
	})
	createTestPost(t, ctx, repo, func(p *domain.Post) {
		p.Tags = []string{"golang", "web"}
		p.Slug = "golang-web-post"
	})
	createTestPost(t, ctx, repo, func(p *domain.Post) {
		p.Tags = []string{"web"}
		p.Slug = "web-post"
	})

	t.Run("TagWithPosts", func(t *testing.T) {
		result, err := repo.FindByTag(ctx, "golang", 1, 10)
		require.NoError(t, err)
		assert.Len(t, result.Posts, 2)
	})

	t.Run("TagWithNoPosts", func(t *testing.T) {
		result, err := repo.FindByTag(ctx, "nonexistent", 1, 10)
		require.NoError(t, err)
		assert.Empty(t, result.Posts)
	})

	t.Run("Pagination", func(t *testing.T) {
		createTestPost(t, ctx, repo, func(p *domain.Post) {
			p.Tags = []string{"golang"}
			p.Slug = "golang-post-2"
		})
		result, err := repo.FindByTag(ctx, "golang", 1, 2)
		require.NoError(t, err)
		assert.Len(t, result.Posts, 2)
		assert.Equal(t, 2, result.TotalPages)
	})
}

func TestMongoPostRepo_Update(t *testing.T) {
	repo, _, cleanup := setupPostRepo(t)
	defer cleanup()
	ctx := context.Background()

	created := createTestPost(t, ctx, repo)

	t.Run("UpdateTitle", func(t *testing.T) {
		now := time.Now().UTC().Truncate(time.Millisecond)
		updated, err := repo.Update(ctx, created.ID, &domain.Post{
			Title:     "Updated Title",
			Slug:      "updated-slug",
			UpdatedAt: now,
		})
		require.NoError(t, err)
		assert.Equal(t, "Updated Title", updated.Title)
		assert.Equal(t, "updated-slug", updated.Slug)

		got, _ := repo.FindByID(ctx, created.ID)
		assert.Equal(t, "Updated Title", got.Title)
	})

	t.Run("UpdateBodyAndTags", func(t *testing.T) {
		now := time.Now().UTC().Truncate(time.Millisecond)
		updated, err := repo.Update(ctx, created.ID, &domain.Post{
			Body:      "New Body",
			Tags:      []string{"updated"},
			UpdatedAt: now,
		})
		require.NoError(t, err)
		assert.Equal(t, "New Body", updated.Body)
		assert.Equal(t, []string{"updated"}, updated.Tags)
	})

	t.Run("UpdateSummaryViaReset", func(t *testing.T) {
		now := time.Now().UTC().Truncate(time.Millisecond)
		updated, err := repo.Update(ctx, created.ID, &domain.Post{
			Title:        "New Title",
			ResetSummary: true,
			UpdatedAt:    now,
		})
		require.NoError(t, err)
		assert.Equal(t, "", updated.Summary)
		assert.Equal(t, domain.PostStatusPending, updated.SummaryStatus)
	})

	t.Run("NotFound", func(t *testing.T) {
		_, err := repo.Update(ctx, "000000000000000000000000", &domain.Post{
			Title:     "Ghost",
			UpdatedAt: time.Now(),
		})
		require.Error(t, err)
		assert.True(t, errors.Is(err, domain.ErrNotFound))
	})
}

func TestMongoPostRepo_UpdateSummary(t *testing.T) {
	repo, _, cleanup := setupPostRepo(t)
	defer cleanup()
	ctx := context.Background()

	created := createTestPost(t, ctx, repo)

	t.Run("SetCompleted", func(t *testing.T) {
		err := repo.UpdateSummary(ctx, created.ID, "AI Generated Summary", domain.PostStatusCompleted)
		require.NoError(t, err)

		got, _ := repo.FindByID(ctx, created.ID)
		assert.Equal(t, "AI Generated Summary", got.Summary)
		assert.Equal(t, domain.PostStatusCompleted, got.SummaryStatus)
	})

	t.Run("SetPending", func(t *testing.T) {
		err := repo.UpdateSummary(ctx, created.ID, "", domain.PostStatusPending)
		require.NoError(t, err)

		got, _ := repo.FindByID(ctx, created.ID)
		assert.Equal(t, "", got.Summary)
		assert.Equal(t, domain.PostStatusPending, got.SummaryStatus)
	})

	t.Run("NotFound", func(t *testing.T) {
		err := repo.UpdateSummary(ctx, "000000000000000000000000", "summary", domain.PostStatusCompleted)
		require.NoError(t, err) // MongoDB UpdateOne does not error on no match
	})
}

func TestMongoPostRepo_Delete(t *testing.T) {
	repo, _, cleanup := setupPostRepo(t)
	defer cleanup()
	ctx := context.Background()

	created := createTestPost(t, ctx, repo)

	t.Run("Success", func(t *testing.T) {
		err := repo.Delete(ctx, created.ID)
		require.NoError(t, err)

		_, err = repo.FindByID(ctx, created.ID)
		assert.True(t, errors.Is(err, domain.ErrNotFound))
	})

	t.Run("NotFound", func(t *testing.T) {
		err := repo.Delete(ctx, "000000000000000000000000")
		require.NoError(t, err)
	})
}

func TestMongoPostRepo_UniqueSlug(t *testing.T) {
	repo, _, cleanup := setupPostRepo(t)
	defer cleanup()
	ctx := context.Background()

	post := tempPost(func(p *domain.Post) {
		p.Slug = "duplicate-slug"
	})
	_, err := repo.Create(ctx, post)
	require.NoError(t, err)

	dup := tempPost(func(p *domain.Post) {
		p.Slug = "duplicate-slug"
	})
	_, err = repo.Create(ctx, dup)
	require.Error(t, err)
	assert.True(t, mongo.IsDuplicateKeyError(err))
}

func TestMongoPostRepo_InvalidObjectID(t *testing.T) {
	repo, _, cleanup := setupPostRepo(t)
	defer cleanup()
	ctx := context.Background()

	t.Run("FindByID", func(t *testing.T) {
		_, err := repo.FindByID(ctx, "not-a-valid-objectid")
		require.Error(t, err)
		assert.True(t, errors.Is(err, domain.ErrNotFound))
	})

	t.Run("Update", func(t *testing.T) {
		_, err := repo.Update(ctx, "not-a-valid-objectid", &domain.Post{
			Title:     "x",
			UpdatedAt: time.Now(),
		})
		require.Error(t, err)
	})

	t.Run("UpdateSummary", func(t *testing.T) {
		err := repo.UpdateSummary(ctx, "not-a-valid-objectid", "x", domain.PostStatusCompleted)
		require.Error(t, err)
	})

	t.Run("Delete", func(t *testing.T) {
		err := repo.Delete(ctx, "not-a-valid-objectid")
		require.Error(t, err)
	})
}

var postCounter int

func createTestPost(t *testing.T, ctx context.Context, repo domain.PostRepository, overrides ...func(*domain.Post)) *domain.Post {
	t.Helper()
	postCounter++
	now := time.Now().UTC().Truncate(time.Millisecond)
	p := &domain.Post{
		Title:     "Integration Test Post",
		Body:      "Integration test body content",
		Slug:      fmt.Sprintf("integration-post-%s-%d", now.Format("150405"), postCounter),
		AuthorID:  "user1",
		Tags:      []string{"integration"},
		CreatedAt: now,
		UpdatedAt: now,
	}
	for _, o := range overrides {
		o(p)
	}
	created, err := repo.Create(ctx, p)
	require.NoError(t, err)
	return created
}
