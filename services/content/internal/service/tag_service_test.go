package service

import (
	"context"
	"errors"
	"testing"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestTagService_GetTags(t *testing.T) {
	qTech := "tech"
	empty := ""

	tests := []struct {
		name       string
		query      *string
		limit      int
		setupMocks func(*mocks.TagRepository)
		wantErr    bool
		wantLen    int
	}{
		{
			name:  "NoQuery_ZeroLimit_CallsFindAll",
			query: nil,
			limit: 0,
			setupMocks: func(tr *mocks.TagRepository) {
				tr.On("FindAll", mock.Anything).Return([]*domain.Tag{
					{Name: "Go"}, {Name: "Rust"},
				}, nil)
			},
			wantErr: false,
			wantLen: 2,
		},
		{
			name:  "EmptyQuery_ZeroLimit_CallsFindAll",
			query: &empty,
			limit: 0,
			setupMocks: func(tr *mocks.TagRepository) {
				tr.On("FindAll", mock.Anything).Return([]*domain.Tag{}, nil)
			},
			wantErr: false,
			wantLen: 0,
		},
		{
			name:  "QueryProvided_CallsSearch",
			query: &qTech,
			limit: 5,
			setupMocks: func(tr *mocks.TagRepository) {
				tr.On("Search", mock.Anything, "tech", 5).Return([]*domain.Tag{
					{Name: "technology"},
				}, nil)
			},
			wantErr: false,
			wantLen: 1,
		},
		{
			name:  "QueryProvided_ZeroLimit_DefaultsTo10",
			query: &qTech,
			limit: 0,
			setupMocks: func(tr *mocks.TagRepository) {
				// The service logic sets limit=10 if limit<=0 inside the search branch
				tr.On("Search", mock.Anything, "tech", 10).Return([]*domain.Tag{}, nil)
			},
			wantErr: false,
			wantLen: 0,
		},
		{
			name:  "FindAll_Error",
			query: nil,
			limit: 0,
			setupMocks: func(tr *mocks.TagRepository) {
				tr.On("FindAll", mock.Anything).Return(nil, errors.New("db fail"))
			},
			wantErr: true,
		},
		{
			name:  "Search_Error",
			query: &qTech,
			limit: 5,
			setupMocks: func(tr *mocks.TagRepository) {
				tr.On("Search", mock.Anything, "tech", 5).Return(nil, errors.New("db fail"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tr := new(mocks.TagRepository)
			tt.setupMocks(tr)

			s := NewTagService(tr)
			got, err := s.GetTags(context.Background(), tt.query, tt.limit)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantLen, len(got))
			}
			tr.AssertExpectations(t)
		})
	}
}