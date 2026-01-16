package domain

import (
	"context"
	"time"
)

type PostEventPayload struct {
	PostID    string    `json:"postId"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	ImageURL  *string   `json:"imageUrl"`
	CreatedAt time.Time `json:"createdAt"`
}

type EventProducer interface {
	PublishPostCreated(ctx context.Context, post *Post) error
	PublishPostUpdated(ctx context.Context, post *Post) error
	PublishPostDeleted(ctx context.Context, id string) error
	Close() error
}