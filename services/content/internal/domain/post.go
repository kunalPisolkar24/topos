package domain

import (
	"context"
	"errors"
	"time"
)

var ErrNotFound = errors.New("not found")

type Post struct {
	ID            string    `bson:"_id,omitempty"`
	Title         string    `bson:"title"`
	Body          string    `bson:"body"`
	Slug          string    `bson:"slug"`
	ImageUrl      *string   `bson:"imageUrl"`
	AuthorID      string    `bson:"authorId"`
	Tags          []string  `bson:"tags"`
	Summary       string    `bson:"summary"`
	SummaryStatus string    `bson:"summaryStatus"`
	CreatedAt     time.Time `bson:"createdAt"`
	UpdatedAt     time.Time `bson:"updatedAt"`
}

type PaginatedPosts struct {
	Posts      []*Post
	TotalPages int
	TotalPosts int64
	Page       int
}

type PostRepository interface {
	Create(ctx context.Context, post *Post) (*Post, error)
	Update(ctx context.Context, id string, post *Post) (*Post, error)
	UpdateSummary(ctx context.Context, id string, summary string, status string) error
	Delete(ctx context.Context, id string) error
	FindAll(ctx context.Context, page, limit int) (*PaginatedPosts, error)
	FindByID(ctx context.Context, id string) (*Post, error)
	FindByAuthor(ctx context.Context, authorID string, page, limit int) (*PaginatedPosts, error)
	FindByTag(ctx context.Context, tag string, page, limit int) (*PaginatedPosts, error)
}

type SummaryProcessor interface {
	GetPost(ctx context.Context, id string) (*Post, error)
	SetPostSummary(ctx context.Context, id, summary, status string) error
}