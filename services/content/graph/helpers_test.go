package graph

import (
	"testing"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/graph/model"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/stretchr/testify/assert"
)

func TestMapDomainPostToModel_NilInput(t *testing.T) {
	got := mapDomainPostToModel(nil)
	assert.Nil(t, got)
}

func TestMapDomainPostToModel_FullPost(t *testing.T) {
	imageURL := "http://example.com/img.png"
	dp := &domain.Post{
		ID:            "post-1",
		Title:         "Hello",
		Body:          "World",
		Slug:          "hello-world",
		ImageUrl:      &imageURL,
		AuthorID:      "user-1",
		Tags:          []string{"go", "graphql"},
		Summary:       "Brief",
		SummaryStatus: "COMPLETED",
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	got := mapDomainPostToModel(dp)

	assert.NotNil(t, got)
	assert.Equal(t, dp.ID, got.ID)
	assert.Equal(t, dp.Title, got.Title)
	assert.Equal(t, dp.Body, got.Body)
	assert.Equal(t, dp.Slug, got.Slug)
	assert.Equal(t, dp.ImageUrl, got.ImageURL)
	assert.NotNil(t, got.Summary)
	assert.Equal(t, dp.Summary, *got.Summary)
	assert.NotNil(t, got.SummaryStatus)
	assert.Equal(t, model.SummaryStatusCompleted, *got.SummaryStatus)
	assert.NotNil(t, got.Author)
	assert.Equal(t, dp.AuthorID, got.Author.ID)
	assert.Len(t, got.Tags, 2)
}

func TestMapDomainPostToModel_EmptySummaryYieldsNil(t *testing.T) {
	dp := &domain.Post{
		ID:      "post-1",
		Summary: "",
	}

	got := mapDomainPostToModel(dp)

	assert.NotNil(t, got)
	assert.Nil(t, got.Summary)
}

func TestMapDomainPostToModel_InvalidSummaryStatus(t *testing.T) {
	dp := &domain.Post{
		ID:            "post-1",
		SummaryStatus: "NOT_A_REAL_STATUS",
	}

	got := mapDomainPostToModel(dp)

	assert.NotNil(t, got)
	assert.Nil(t, got.SummaryStatus)
}

func TestMapDomainPostToModel_EmptySummaryStatus(t *testing.T) {
	dp := &domain.Post{ID: "post-1"}

	got := mapDomainPostToModel(dp)

	assert.NotNil(t, got)
	assert.Nil(t, got.SummaryStatus)
}

func TestMapDomainPaginatedToModel_NilInput(t *testing.T) {
	got := mapDomainPaginatedToModel(nil)
	assert.Nil(t, got)
}

func TestMapDomainPaginatedToModel_SkipsNilPosts(t *testing.T) {
	pp := &domain.PaginatedPosts{
		Posts: []*domain.Post{
			{ID: "1", Title: "First"},
			nil,
			{ID: "2", Title: "Second"},
		},
		TotalPages: 1,
		TotalPosts: 2,
		Page:       1,
	}

	got := mapDomainPaginatedToModel(pp)

	assert.NotNil(t, got)
	assert.Len(t, got.Posts, 2)
	assert.Equal(t, "1", got.Posts[0].ID)
	assert.Equal(t, "2", got.Posts[1].ID)
	assert.Equal(t, 1, got.TotalPages)
	assert.Equal(t, 2, got.TotalPosts)
	assert.Equal(t, 1, got.CurrentPage)
}

func TestMapDomainPaginatedToModel_EmptyPosts(t *testing.T) {
	pp := &domain.PaginatedPosts{
		Posts:      nil,
		TotalPages: 0,
		TotalPosts: 0,
		Page:       1,
	}

	got := mapDomainPaginatedToModel(pp)

	assert.NotNil(t, got)
	assert.Empty(t, got.Posts)
	assert.Equal(t, 1, got.CurrentPage)
}

func TestMapTags(t *testing.T) {
	got := mapTags([]string{"a", "b"})

	assert.Len(t, got, 2)
	assert.Equal(t, "a", got[0].ID)
	assert.Equal(t, "a", got[0].Name)
	assert.Equal(t, "b", got[1].ID)
	assert.Equal(t, "b", got[1].Name)
}

func TestMapTags_Empty(t *testing.T) {
	got := mapTags(nil)
	assert.Empty(t, got)
}
