package graph

import (
	"github.com/kunalPisolkar24/blogapp/services/content/internal/service"
)

type Resolver struct {
	PostService *service.PostService
	TagService  *service.TagService
}