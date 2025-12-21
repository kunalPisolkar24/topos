package service

import (
	"context"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
)

type TagService struct {
	repo domain.TagRepository
}

func NewTagService(repo domain.TagRepository) *TagService {
	return &TagService{repo: repo}
}

func (s *TagService) GetTags(ctx context.Context) ([]*domain.Tag, error) {
	return s.repo.FindAll(ctx)
}