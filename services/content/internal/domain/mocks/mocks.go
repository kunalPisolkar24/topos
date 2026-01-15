package mocks

import (
	"context"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/stretchr/testify/mock"
)

type PostRepository struct {
	mock.Mock
}

func (m *PostRepository) Create(ctx context.Context, post *domain.Post) (*domain.Post, error) {
	args := m.Called(ctx, post)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Post), args.Error(1)
}

func (m *PostRepository) Update(ctx context.Context, id string, post *domain.Post) (*domain.Post, error) {
	args := m.Called(ctx, id, post)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Post), args.Error(1)
}

func (m *PostRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *PostRepository) FindAll(ctx context.Context, page, limit int) (*domain.PaginatedPosts, error) {
	args := m.Called(ctx, page, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.PaginatedPosts), args.Error(1)
}

func (m *PostRepository) FindByID(ctx context.Context, id string) (*domain.Post, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Post), args.Error(1)
}

func (m *PostRepository) FindByAuthor(ctx context.Context, authorID string, page, limit int) (*domain.PaginatedPosts, error) {
	args := m.Called(ctx, authorID, page, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.PaginatedPosts), args.Error(1)
}

func (m *PostRepository) FindByTag(ctx context.Context, tag string, page, limit int) (*domain.PaginatedPosts, error) {
	args := m.Called(ctx, tag, page, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.PaginatedPosts), args.Error(1)
}

type TagRepository struct {
	mock.Mock
}

func (m *TagRepository) CreateOrFind(ctx context.Context, name string) (*domain.Tag, error) {
	args := m.Called(ctx, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Tag), args.Error(1)
}

func (m *TagRepository) FindAll(ctx context.Context) ([]*domain.Tag, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Tag), args.Error(1)
}

func (m *TagRepository) Search(ctx context.Context, query string, limit int) ([]*domain.Tag, error) {
	args := m.Called(ctx, query, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Tag), args.Error(1)
}

type EventProducer struct {
	mock.Mock
}

func (m *EventProducer) PublishPostCreated(ctx context.Context, post *domain.Post) error {
	args := m.Called(ctx, post)
	return args.Error(0)
}

func (m *EventProducer) PublishPostUpdated(ctx context.Context, post *domain.Post) error {
	args := m.Called(ctx, post)
	return args.Error(0)
}

func (m *EventProducer) PublishPostDeleted(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *EventProducer) Close() error {
	args := m.Called()
	return args.Error(0)
}