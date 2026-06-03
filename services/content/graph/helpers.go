package graph

import (
	"github.com/kunalPisolkar24/blogapp/services/content/graph/model"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
)

func mapTags(tagNames []string) []*model.Tag {
	var tags []*model.Tag
	for _, name := range tagNames {
		tags = append(tags, &model.Tag{ID: name, Name: name})
	}
	return tags
}

func mapDomainPostToModel(dp *domain.Post) *model.Post {
	if dp == nil {
		return nil
	}

	var summaryStatus *model.SummaryStatus
	if dp.SummaryStatus != "" {
		status := model.SummaryStatus(dp.SummaryStatus)
		if status.IsValid() {
			summaryStatus = &status
		}
	}

	return &model.Post{
		ID:            dp.ID,
		Title:         dp.Title,
		Body:          dp.Body,
		Slug:          dp.Slug,
		ImageURL:      dp.ImageUrl,
		Summary:       &dp.Summary,
		SummaryStatus: summaryStatus,
		Tags:          mapTags(dp.Tags),
		CreatedAt:     dp.CreatedAt.String(),
		UpdatedAt:     dp.UpdatedAt.String(),
		Author:        &model.User{ID: dp.AuthorID},
	}
}

func mapDomainPaginatedToModel(pp *domain.PaginatedPosts) *model.PaginatedPosts {
	if pp == nil {
		return nil
	}

	posts := make([]*model.Post, 0, len(pp.Posts))
	for _, dp := range pp.Posts {
		if mapped := mapDomainPostToModel(dp); mapped != nil {
			posts = append(posts, mapped)
		}
	}

	return &model.PaginatedPosts{
		Posts:       posts,
		TotalPages:  pp.TotalPages,
		TotalPosts:  int(pp.TotalPosts),
		CurrentPage: pp.Page,
	}
}