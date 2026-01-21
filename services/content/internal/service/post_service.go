package service

import (
	"context"
	"strings"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
)

type PostService struct {
	postRepo      domain.PostRepository
	tagRepo       domain.TagRepository
	eventProducer domain.EventProducer
	aiService     domain.AIService
}

func NewPostService(postRepo domain.PostRepository, tagRepo domain.TagRepository, eventProducer domain.EventProducer, aiService domain.AIService) *PostService {
	return &PostService{
		postRepo:      postRepo,
		tagRepo:       tagRepo,
		eventProducer: eventProducer,
		aiService:     aiService,
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

	createdPost, err := s.postRepo.Create(ctx, post)
	if err != nil {
		return nil, err
	}

	if s.eventProducer != nil {
		if err := s.eventProducer.PublishPostCreated(ctx, createdPost); err != nil {
			logger.Error("Failed to publish PostCreated event", "error", err, "postID", createdPost.ID)
		}
	}

	return createdPost, nil
}

func (s *PostService) UpdatePost(ctx context.Context, id string, title, body *string, tags []string, imageUrl *string) (*domain.Post, error) {
	post := &domain.Post{
		UpdatedAt: time.Now(),
	}

	if title != nil {
		post.Title = *title
		post.Slug = generateSlug(*title)
	}
	if body != nil {
		post.Body = *body
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

	updatedPost, err := s.postRepo.Update(ctx, id, post)
	if err != nil {
		return nil, err
	}

	if s.eventProducer != nil {
		if err := s.eventProducer.PublishPostUpdated(ctx, updatedPost); err != nil {
			logger.Error("Failed to publish PostUpdated event", "error", err, "postID", updatedPost.ID)
		}
	}

	return updatedPost, nil
}

func (s *PostService) SetPostSummary(ctx context.Context, id, summary, status string) error {
	return s.postRepo.UpdateSummary(ctx, id, summary, status)
}

func (s *PostService) DeletePost(ctx context.Context, id string) error {
	err := s.postRepo.Delete(ctx, id)
	if err != nil {
		return err
	}

	if s.eventProducer != nil {
		if err := s.eventProducer.PublishPostDeleted(ctx, id); err != nil {
			logger.Error("Failed to publish PostDeleted event", "error", err, "postID", id)
		}
	}

	return nil
}

func (s *PostService) GetPosts(ctx context.Context, page, limit int) (*domain.PaginatedPosts, error) {
	return s.postRepo.FindAll(ctx, page, limit)
}

func (s *PostService) GetPost(ctx context.Context, id string) (*domain.Post, error) {
	return s.postRepo.FindByID(ctx, id)
}

func (s *PostService) GetPostsByAuthor(ctx context.Context, authorID string, page, limit int) (*domain.PaginatedPosts, error) {
	return s.postRepo.FindByAuthor(ctx, authorID, page, limit)
}

func (s *PostService) GetPostsByTag(ctx context.Context, tag string, page, limit int) (*domain.PaginatedPosts, error) {
	return s.postRepo.FindByTag(ctx, tag, page, limit)
}

func (s *PostService) GenerateTags(ctx context.Context, title, body string) ([]string, error) {
	return s.aiService.GenerateTags(ctx, title, body)
}

func (s *PostService) GeneratePostContent(ctx context.Context, prompt string) (*domain.GeneratedPost, error) {
	return s.aiService.GeneratePost(ctx, prompt)
}

func generateSlug(title string) string {
	return strings.ToLower(strings.ReplaceAll(title, " ", "-")) + "-" + time.Now().Format("20060102150405")
}