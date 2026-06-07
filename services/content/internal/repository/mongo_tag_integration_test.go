//go:build integration

package repository

import (
	"context"
	"testing"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/mongo"
)

func setupTagRepo(t *testing.T) (domain.TagRepository, *mongo.Database, func()) {
	t.Helper()
	db, cleanup := testhelpers.SetupMongoDB(t)
	repo := NewMongoTagRepository(db)
	return repo, db, cleanup
}

func TestMongoTagRepo_CreateOrFind(t *testing.T) {
	repo, _, cleanup := setupTagRepo(t)
	defer cleanup()
	ctx := context.Background()

	t.Run("CreateNew", func(t *testing.T) {
		tag, err := repo.CreateOrFind(ctx, "golang")
		require.NoError(t, err)
		assert.NotEmpty(t, tag.ID)
		assert.Equal(t, "golang", tag.Name)
	})

	t.Run("FindExisting", func(t *testing.T) {
		first, err := repo.CreateOrFind(ctx, "golang")
		require.NoError(t, err)

		second, err := repo.CreateOrFind(ctx, "golang")
		require.NoError(t, err)

		assert.Equal(t, first.ID, second.ID)
		assert.Equal(t, "golang", second.Name)
	})

	t.Run("MultipleTags", func(t *testing.T) {
		tag1, err := repo.CreateOrFind(ctx, "web")
		require.NoError(t, err)
		assert.Equal(t, "web", tag1.Name)

		tag2, err := repo.CreateOrFind(ctx, "devops")
		require.NoError(t, err)
		assert.Equal(t, "devops", tag2.Name)

		assert.NotEqual(t, tag1.ID, tag2.ID)
	})
}

func TestMongoTagRepo_FindAll(t *testing.T) {
	repo, _, cleanup := setupTagRepo(t)
	defer cleanup()
	ctx := context.Background()

	t.Run("EmptyCollection", func(t *testing.T) {
		tags, err := repo.FindAll(ctx)
		require.NoError(t, err)
		assert.Empty(t, tags)
	})

	_, _ = repo.CreateOrFind(ctx, "golang")
	_, _ = repo.CreateOrFind(ctx, "devops")
	_, _ = repo.CreateOrFind(ctx, "testing")

	t.Run("ReturnsAllTagsSorted", func(t *testing.T) {
		tags, err := repo.FindAll(ctx)
		require.NoError(t, err)
		assert.Len(t, tags, 3)
		assert.Equal(t, "devops", tags[0].Name)
		assert.Equal(t, "golang", tags[1].Name)
		assert.Equal(t, "testing", tags[2].Name)
	})
}

func TestMongoTagRepo_Search(t *testing.T) {
	repo, _, cleanup := setupTagRepo(t)
	defer cleanup()
	ctx := context.Background()

	_, _ = repo.CreateOrFind(ctx, "golang")
	_, _ = repo.CreateOrFind(ctx, "go-web")
	_, _ = repo.CreateOrFind(ctx, "react")
	_, _ = repo.CreateOrFind(ctx, "graphql")

	t.Run("PrefixMatch", func(t *testing.T) {
		tags, err := repo.Search(ctx, "go", 10)
		require.NoError(t, err)
		assert.Len(t, tags, 2)
	})

	t.Run("CaseInsensitive", func(t *testing.T) {
		tags, err := repo.Search(ctx, "GO", 10)
		require.NoError(t, err)
		assert.Len(t, tags, 2)
	})

	t.Run("NoMatch", func(t *testing.T) {
		tags, err := repo.Search(ctx, "nonexistent", 10)
		require.NoError(t, err)
		assert.Empty(t, tags)
	})

	t.Run("EmptyQueryReturnsAll", func(t *testing.T) {
		tags, err := repo.Search(ctx, "", 10)
		require.NoError(t, err)
		assert.Len(t, tags, 4)
	})

	t.Run("Limit", func(t *testing.T) {
		tags, err := repo.Search(ctx, "", 2)
		require.NoError(t, err)
		assert.Len(t, tags, 2)
	})

	t.Run("ZeroLimitDefaultsTo10", func(t *testing.T) {
		tags, err := repo.Search(ctx, "", 0)
		require.NoError(t, err)
		assert.Len(t, tags, 4)
	})
}
