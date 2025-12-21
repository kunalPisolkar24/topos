package graph

import (
	"context"
	"errors"

	"github.com/kunalPisolkar24/blogapp/services/content/graph/model"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/middleware"
)

func (r *mutationResolver) CreatePost(ctx context.Context, input model.CreatePostInput) (*model.Post, error) {
	userID, ok := ctx.Value(middleware.UserIDKey).(string)
	if !ok || userID == "" {
		return nil, errors.New("unauthorized")
	}

	var tags []string
	if input.Tags != nil {
		tags = append(tags, input.Tags...)
	}

	domainPost, err := r.PostService.CreatePost(ctx, input.Title, input.Body, userID, tags, input.ImageURL)
	if err != nil {
		return nil, err
	}

	return &model.Post{
		ID:        domainPost.ID,
		Title:     domainPost.Title,
		Body:      domainPost.Body,
		Slug:      domainPost.Slug,
		ImageURL:  domainPost.ImageUrl,
		Tags:      mapTags(domainPost.Tags),
		CreatedAt: domainPost.CreatedAt.String(),
		UpdatedAt: domainPost.UpdatedAt.String(),
		Author:    &model.User{ID: userID},
	}, nil
}

func (r *mutationResolver) UpdatePost(ctx context.Context, id string, input model.UpdatePostInput) (*model.Post, error) {
	userID, ok := ctx.Value(middleware.UserIDKey).(string)
	if !ok || userID == "" {
		return nil, errors.New("unauthorized")
	}

	existingPost, err := r.PostService.GetPost(ctx, id)
	if err != nil {
		return nil, errors.New("post not found")
	}

	if existingPost.AuthorID != userID {
		return nil, errors.New("forbidden")
	}

	var tags []string
	if input.Tags != nil {
		tags = append(tags, input.Tags...)
	}

	domainPost, err := r.PostService.UpdatePost(ctx, id, input.Title, input.Body, tags, input.ImageURL)
	if err != nil {
		return nil, err
	}

	return &model.Post{
		ID:        domainPost.ID,
		Title:     domainPost.Title,
		Body:      domainPost.Body,
		Slug:      domainPost.Slug,
		ImageURL:  domainPost.ImageUrl,
		Tags:      mapTags(domainPost.Tags),
		CreatedAt: domainPost.CreatedAt.String(),
		UpdatedAt: domainPost.UpdatedAt.String(),
		Author:    &model.User{ID: domainPost.AuthorID},
	}, nil
}

func (r *mutationResolver) DeletePost(ctx context.Context, id string) (bool, error) {
	userID, ok := ctx.Value(middleware.UserIDKey).(string)
	if !ok || userID == "" {
		return false, errors.New("unauthorized")
	}

	existingPost, err := r.PostService.GetPost(ctx, id)
	if err != nil {
		return false, errors.New("post not found")
	}

	if existingPost.AuthorID != userID {
		return false, errors.New("forbidden")
	}

	if err := r.PostService.DeletePost(ctx, id); err != nil {
		return false, err
	}

	return true, nil
}

func (r *queryResolver) Posts(ctx context.Context, page *int, limit *int) ([]*model.Post, error) {
	p := 1
	if page != nil {
		p = *page
	}
	l := 10
	if limit != nil {
		l = *limit
	}

	domainPosts, err := r.PostService.GetPosts(ctx, p, l)
	if err != nil {
		return nil, err
	}

	var posts []*model.Post
	for _, dp := range domainPosts {
		posts = append(posts, &model.Post{
			ID:        dp.ID,
			Title:     dp.Title,
			Body:      dp.Body,
			Slug:      dp.Slug,
			ImageURL:  dp.ImageUrl,
			Tags:      mapTags(dp.Tags),
			CreatedAt: dp.CreatedAt.String(),
			UpdatedAt: dp.UpdatedAt.String(),
			Author:    &model.User{ID: dp.AuthorID},
		})
	}
	return posts, nil
}

func (r *queryResolver) Post(ctx context.Context, id string) (*model.Post, error) {
	dp, err := r.PostService.GetPost(ctx, id)
	if err != nil {
		return nil, err
	}
	return &model.Post{
		ID:        dp.ID,
		Title:     dp.Title,
		Body:      dp.Body,
		Slug:      dp.Slug,
		ImageURL:  dp.ImageUrl,
		Tags:      mapTags(dp.Tags),
		CreatedAt: dp.CreatedAt.String(),
		UpdatedAt: dp.UpdatedAt.String(),
		Author:    &model.User{ID: dp.AuthorID},
	}, nil
}

func (r *queryResolver) Tags(ctx context.Context) ([]*model.Tag, error) {
	domainTags, err := r.TagService.GetTags(ctx)
	if err != nil {
		return nil, err
	}

	var tags []*model.Tag
	for _, dt := range domainTags {
		tags = append(tags, &model.Tag{
			ID:   dt.ID,
			Name: dt.Name,
		})
	}
	return tags, nil
}

func (r *userResolver) Posts(ctx context.Context, obj *model.User) ([]*model.Post, error) {
	domainPosts, err := r.PostService.GetPostsByAuthor(ctx, obj.ID)
	if err != nil {
		return nil, err
	}

	var posts []*model.Post
	for _, dp := range domainPosts {
		posts = append(posts, &model.Post{
			ID:        dp.ID,
			Title:     dp.Title,
			Body:      dp.Body,
			Slug:      dp.Slug,
			ImageURL:  dp.ImageUrl,
			Tags:      mapTags(dp.Tags),
			CreatedAt: dp.CreatedAt.String(),
			UpdatedAt: dp.UpdatedAt.String(),
			Author:    &model.User{ID: dp.AuthorID},
		})
	}
	return posts, nil
}

func mapTags(tagNames []string) []*model.Tag {
	var tags []*model.Tag
	for _, name := range tagNames {
		tags = append(tags, &model.Tag{ID: name, Name: name})
	}
	return tags
}

func (r *Resolver) Mutation() MutationResolver { return &mutationResolver{r} }
func (r *Resolver) Query() QueryResolver       { return &queryResolver{r} }
func (r *Resolver) User() UserResolver         { return &userResolver{r} }

type mutationResolver struct{ *Resolver }
type queryResolver struct{ *Resolver }
type userResolver struct{ *Resolver }