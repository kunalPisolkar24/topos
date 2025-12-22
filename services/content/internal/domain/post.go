package domain

import (
	"context"
	"time"
)

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

type PostRepository interface {
	Create(ctx context.Context, post *Post) (*Post, error)
	Update(ctx context.Context, id string, post *Post) (*Post, error)
	Delete(ctx context.Context, id string) error
	FindAll(ctx context.Context, page, limit int) ([]*Post, error)
	FindByID(ctx context.Context, id string) (*Post, error)
	FindByAuthor(ctx context.Context, authorID string) ([]*Post, error)
}
