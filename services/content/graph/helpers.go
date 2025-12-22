package graph

import "github.com/kunalPisolkar24/blogapp/services/content/graph/model"

func mapTags(tagNames []string) []*model.Tag {
	var tags []*model.Tag
	for _, name := range tagNames {
		tags = append(tags, &model.Tag{ID: name, Name: name})
	}
	return tags
}