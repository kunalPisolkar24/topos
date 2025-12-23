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