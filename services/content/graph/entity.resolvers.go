package graph

import (
	"context"

	"github.com/kunalPisolkar24/blogapp/services/content/graph/model"
)

func (r *entityResolver) FindPostByID(ctx context.Context, id string) (*model.Post, error) {
	return r.Resolver.Query().Post(ctx, id)
}

func (r *entityResolver) FindUserByID(ctx context.Context, id string) (*model.User, error) {
	return &model.User{
		ID: id,
	}, nil
}

func (r *Resolver) Entity() EntityResolver { return &entityResolver{r} }

type entityResolver struct{ *Resolver }