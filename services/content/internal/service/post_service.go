package service

import (
	"context"
	"strings"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
)

type PostService struct {
	postRepo domain.PostRepository
	tagRepo  domain.TagRepository
}

func NewPostService(postRepo domain.PostRepository, tagRepo domain.TagRepository) *PostService {
	return &PostService{
		postRepo: postRepo,
		tagRepo:  tagRepo,
	}
}

func (s *PostService) CreatePost(ctx context.Context, title, body, authorID string, tags []string, imageUrl *string) (*domain.Post, error) {
	slug := generateSlug(title)

	for _, tagName := range tags {
		_, _ = s.tagRepo.CreateOrFind(ctx, tagName)
	}

	post := &domain.Post{
		Title:         title,
		Body:          body,
		Slug:          slug,
		AuthorID:      authorID,
		Tags:          tags,
		ImageUrl:      imageUrl,
		Summary:       "",
		SummaryStatus: "PENDING",
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	return s.postRepo.Create(ctx, post)
}

func (s *PostService) UpdatePost(ctx context.Context, id string, title, body *string, tags []string, imageUrl *string) (*domain.Post, error) {
	post := &domain.Post{
		UpdatedAt: time.Now(),
	}

	contentChanged := false

	if title != nil {
		post.Title = *title
		post.Slug = generateSlug(*title)
		contentChanged = true
	}
	if body != nil {
		post.Body = *body
		contentChanged = true
	}
	if imageUrl != nil {
		post.ImageUrl = imageUrl
	}
	if tags != nil {
		post.Tags = tags
		for _, tagName := range tags {
			_, _ = s.tagRepo.CreateOrFind(ctx, tagName)
		}
	}

	if contentChanged {
		post.SummaryStatus = "PENDING"
	}

	return s.postRepo.Update(ctx, id, post)
}

func (s *PostService) DeletePost(ctx context.Context, id string) error {
	return s.postRepo.Delete(ctx, id)
}

func (s *PostService) GetPosts(ctx context.Context, page, limit int) ([]*domain.Post, error) {
	return s.postRepo.FindAll(ctx, page, limit)
}

func (s *PostService) GetPost(ctx context.Context, id string) (*domain.Post, error) {
	return s.postRepo.FindByID(ctx, id)
}

func (s *PostService) GetPostsByAuthor(ctx context.Context, authorID string) ([]*domain.Post, error) {
	return s.postRepo.FindByAuthor(ctx, authorID)
}

func (s *PostService) GetPostsByTag(ctx context.Context, tag string, page, limit int) ([]*domain.Post, error) {
	return s.postRepo.FindByTag(ctx, tag, page, limit)
}

func generateSlug(title string) string {
	return strings.ToLower(strings.ReplaceAll(title, " ", "-")) + "-" + time.Now().Format("20060102150405")
}
