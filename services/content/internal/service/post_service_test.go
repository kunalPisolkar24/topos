package service

import (
	"context"
	"errors"
	"testing"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain/mocks"
	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.mongodb.org/mongo-driver/mongo"
)

func init() {
	logger.Init()
}

func TestPostService_CreatePost(t *testing.T) {
	type args struct {
		title    string
		body     string
		authorID string
		tags     []string
		imageUrl *string
		summary  *string
	}

	img := "http://example.com/image.jpg"

	tests := []struct {
		name          string
		args          args
		setupMocks    func(*mocks.PostRepository, *mocks.TagRepository, *mocks.EventProducer)
		expectedError bool
		checkResponse func(*testing.T, *domain.Post)
	}{
		{
			name: "Success_FullData",
			args: args{
				title:    "Test Title",
				body:     "Test Body",
				authorID: "user123",
				tags:     []string{"go"},
				imageUrl: &img,
			},
			setupMocks: func(pr *mocks.PostRepository, tr *mocks.TagRepository, ep *mocks.EventProducer) {
				tr.On("CreateOrFind", mock.Anything, "go").Return(&domain.Tag{ID: "1", Name: "go"}, nil)

				pr.On("Create", mock.Anything, mock.MatchedBy(func(p *domain.Post) bool {
					return p.Title == "Test Title" && p.Slug != "" && p.SummaryStatus == "PENDING"
				})).Return(&domain.Post{
					ID:       "post123",
					Title:    "Test Title",
					AuthorID: "user123",
				}, nil)

				ep.On("PublishPostCreated", mock.Anything, mock.MatchedBy(func(p *domain.Post) bool {
					return p.ID == "post123"
				})).Return(nil)
			},
			expectedError: false,
			checkResponse: func(t *testing.T, p *domain.Post) {
				assert.NotNil(t, p)
				assert.Equal(t, "post123", p.ID)
			},
		},
		{
			name: "Success_WithSummary",
			args: args{
				title:    "AI Title",
				body:     "AI Body",
				authorID: "user123",
				summary:  func() *string { s := "AI Summary"; return &s }(),
			},
			setupMocks: func(pr *mocks.PostRepository, tr *mocks.TagRepository, ep *mocks.EventProducer) {
				pr.On("Create", mock.Anything, mock.MatchedBy(func(p *domain.Post) bool {
					return p.Summary == "AI Summary" && p.SummaryStatus == "COMPLETED"
				})).Return(&domain.Post{
					ID:       "post456",
					Title:    "AI Title",
					AuthorID: "user123",
				}, nil)

				ep.On("PublishPostCreated", mock.Anything, mock.Anything).Return(nil)
			},
			expectedError: false,
		},
		{
			name: "Success_EventPublishFailure_Ignored",
			args: args{
				title:    "Test Title",
				body:     "Body",
				authorID: "user1",
				tags:     []string{},
			},
			setupMocks: func(pr *mocks.PostRepository, tr *mocks.TagRepository, ep *mocks.EventProducer) {
				pr.On("Create", mock.Anything, mock.Anything).Return(&domain.Post{ID: "post1"}, nil)
				ep.On("PublishPostCreated", mock.Anything, mock.Anything).Return(errors.New("kafka error"))
			},
			expectedError: false,
		},
		{
			name: "Failure_RepoError",
			args: args{
				title:    "Test Title",
				body:     "Body",
				authorID: "user1",
			},
			setupMocks: func(pr *mocks.PostRepository, tr *mocks.TagRepository, ep *mocks.EventProducer) {
				pr.On("Create", mock.Anything, mock.Anything).Return(nil, errors.New("db error"))
			},
			expectedError: true,
		},
		{
			name: "Success_RetriesOnDuplicateSlug",
			args: args{
				title:    "Same Title",
				body:     "Body",
				authorID: "user1",
			},
			setupMocks: func(pr *mocks.PostRepository, tr *mocks.TagRepository, ep *mocks.EventProducer) {
				pr.On("Create", mock.Anything, mock.Anything).Return(nil, mongo.WriteException{WriteErrors: mongo.WriteErrors{{Code: 11000}}}).Once()
				pr.On("Create", mock.Anything, mock.Anything).Return(&domain.Post{ID: "post-retry-success"}, nil).Once()
				ep.On("PublishPostCreated", mock.Anything, mock.MatchedBy(func(p *domain.Post) bool {
					return p.ID == "post-retry-success"
				})).Return(nil)
			},
			expectedError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := new(mocks.PostRepository)
			tr := new(mocks.TagRepository)
			ep := new(mocks.EventProducer)
			ai := new(mocks.AIService)

			if tt.setupMocks != nil {
				tt.setupMocks(pr, tr, ep)
			}

			s := NewPostService(pr, tr, ep, ai)
			got, err := s.CreatePost(context.Background(), tt.args.title, tt.args.body, tt.args.authorID, tt.args.tags, tt.args.imageUrl, tt.args.summary)

			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			if tt.checkResponse != nil {
				tt.checkResponse(t, got)
			}
			pr.AssertExpectations(t)
			tr.AssertExpectations(t)
			ep.AssertExpectations(t)
		})
	}
}

func TestPostService_UpdatePost(t *testing.T) {
	type args struct {
		id       string
		actorID  string
		title    *string
		body     *string
		tags     []string
		imageUrl *string
	}

	title := "New Title"
	body := "New Body"
	img := "new.jpg"
	id := "post123"
	author := "user1"

	tests := []struct {
		name          string
		args          args
		setupMocks    func(*mocks.PostRepository, *mocks.TagRepository, *mocks.EventProducer)
		expectedError bool
	}{
		{
			name: "Success_FullUpdate",
			args: args{
				id:       id,
				actorID:  author,
				title:    &title,
				body:     &body,
				imageUrl: &img,
				tags:     []string{"newtag"},
			},
			setupMocks: func(pr *mocks.PostRepository, tr *mocks.TagRepository, ep *mocks.EventProducer) {
				pr.On("FindByID", mock.Anything, id).Return(&domain.Post{ID: id, AuthorID: author}, nil)
				tr.On("CreateOrFind", mock.Anything, "newtag").Return(&domain.Tag{}, nil)

				pr.On("Update", mock.Anything, id, mock.MatchedBy(func(p *domain.Post) bool {
					return p.Title == title &&
						p.Body == body &&
						*p.ImageUrl == img &&
						len(p.Tags) == 1 &&
						!p.UpdatedAt.IsZero() &&
						p.Summary == "" &&
						p.SummaryStatus == "PENDING"
				})).Return(&domain.Post{ID: id, Title: title}, nil)

				ep.On("PublishPostUpdated", mock.Anything, mock.Anything).Return(nil)
			},
			expectedError: false,
		},
		{
			name: "Success_PartialUpdate_TitleOnly",
			args: args{
				id:      id,
				actorID: author,
				title:   &title,
			},
			setupMocks: func(pr *mocks.PostRepository, tr *mocks.TagRepository, ep *mocks.EventProducer) {
				pr.On("FindByID", mock.Anything, id).Return(&domain.Post{ID: id, AuthorID: author}, nil)
				pr.On("Update", mock.Anything, id, mock.MatchedBy(func(p *domain.Post) bool {
					return p.Title == title &&
						p.Body == "" &&
						p.ImageUrl == nil &&
						p.Tags == nil &&
						p.Summary == "" &&
						p.SummaryStatus == "PENDING"
				})).Return(&domain.Post{ID: id}, nil)

				ep.On("PublishPostUpdated", mock.Anything, mock.Anything).Return(nil)
			},
			expectedError: false,
		},
		{
			name: "Success_ImageOnly_DoesNotResetSummary",
			args: args{
				id:       id,
				actorID:  author,
				imageUrl: &img,
			},
			setupMocks: func(pr *mocks.PostRepository, tr *mocks.TagRepository, ep *mocks.EventProducer) {
				pr.On("FindByID", mock.Anything, id).Return(&domain.Post{ID: id, AuthorID: author}, nil)
				pr.On("Update", mock.Anything, id, mock.MatchedBy(func(p *domain.Post) bool {
					return p.Summary == "" && p.SummaryStatus == ""
				})).Return(&domain.Post{ID: id}, nil)

				ep.On("PublishPostUpdated", mock.Anything, mock.Anything).Return(nil)
			},
			expectedError: false,
		},
		{
			name: "Failure_Forbidden",
			args: args{id: id, actorID: "other-user", body: &body},
			setupMocks: func(pr *mocks.PostRepository, tr *mocks.TagRepository, ep *mocks.EventProducer) {
				pr.On("FindByID", mock.Anything, id).Return(&domain.Post{ID: id, AuthorID: author}, nil)
			},
			expectedError: true,
		},
		{
			name: "Failure_NotFound",
			args: args{id: id, actorID: author, body: &body},
			setupMocks: func(pr *mocks.PostRepository, tr *mocks.TagRepository, ep *mocks.EventProducer) {
				pr.On("FindByID", mock.Anything, id).Return(nil, domain.ErrNotFound)
			},
			expectedError: true,
		},
		{
			name: "Failure_RepoUpdate",
			args: args{id: id, actorID: author, body: &body},
			setupMocks: func(pr *mocks.PostRepository, tr *mocks.TagRepository, ep *mocks.EventProducer) {
				pr.On("FindByID", mock.Anything, id).Return(&domain.Post{ID: id, AuthorID: author}, nil)
				pr.On("Update", mock.Anything, id, mock.Anything).Return(nil, errors.New("update failed"))
			},
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := new(mocks.PostRepository)
			tr := new(mocks.TagRepository)
			ep := new(mocks.EventProducer)
			ai := new(mocks.AIService)

			tt.setupMocks(pr, tr, ep)

			s := NewPostService(pr, tr, ep, ai)
			_, err := s.UpdatePost(context.Background(), tt.args.id, tt.args.actorID, tt.args.title, tt.args.body, tt.args.tags, tt.args.imageUrl)

			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			pr.AssertExpectations(t)
		})
	}
}

func TestPostService_DeletePost(t *testing.T) {
	id := "post123"
	author := "user1"
	tests := []struct {
		name          string
		actorID       string
		setupMocks    func(*mocks.PostRepository, *mocks.EventProducer)
		expectedError bool
	}{
		{
			name:    "Success",
			actorID: author,
			setupMocks: func(pr *mocks.PostRepository, ep *mocks.EventProducer) {
				pr.On("FindByID", mock.Anything, id).Return(&domain.Post{ID: id, AuthorID: author}, nil)
				pr.On("Delete", mock.Anything, id).Return(nil)
				ep.On("PublishPostDeleted", mock.Anything, id).Return(nil)
			},
			expectedError: false,
		},
		{
			name:    "Failure_Repo",
			actorID: author,
			setupMocks: func(pr *mocks.PostRepository, ep *mocks.EventProducer) {
				pr.On("FindByID", mock.Anything, id).Return(&domain.Post{ID: id, AuthorID: author}, nil)
				pr.On("Delete", mock.Anything, id).Return(errors.New("fail"))
			},
			expectedError: true,
		},
		{
			name:    "Failure_Forbidden",
			actorID: "other-user",
			setupMocks: func(pr *mocks.PostRepository, ep *mocks.EventProducer) {
				pr.On("FindByID", mock.Anything, id).Return(&domain.Post{ID: id, AuthorID: author}, nil)
			},
			expectedError: true,
		},
		{
			name:    "Failure_NotFound",
			actorID: author,
			setupMocks: func(pr *mocks.PostRepository, ep *mocks.EventProducer) {
				pr.On("FindByID", mock.Anything, id).Return(nil, domain.ErrNotFound)
			},
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := new(mocks.PostRepository)
			ep := new(mocks.EventProducer)
			ai := new(mocks.AIService)
			tt.setupMocks(pr, ep)
			s := NewPostService(pr, nil, ep, ai)
			err := s.DeletePost(context.Background(), id, tt.actorID)
			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestPostService_GetPost(t *testing.T) {
	tests := []struct {
		name       string
		id         string
		setupMocks func(*mocks.PostRepository)
		wantErr    bool
	}{
		{
			name: "Success",
			id:   "1",
			setupMocks: func(pr *mocks.PostRepository) {
				pr.On("FindByID", mock.Anything, "1").Return(&domain.Post{ID: "1"}, nil)
			},
			wantErr: false,
		},
		{
			name: "NotFound",
			id:   "1",
			setupMocks: func(pr *mocks.PostRepository) {
				pr.On("FindByID", mock.Anything, "1").Return(nil, errors.New("not found"))
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := new(mocks.PostRepository)
			ai := new(mocks.AIService)
			tt.setupMocks(pr)
			s := NewPostService(pr, nil, nil, ai)
			_, err := s.GetPost(context.Background(), tt.id)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestPostService_GetPosts(t *testing.T) {
	tests := []struct {
		name       string
		setupMocks func(*mocks.PostRepository)
		wantErr    bool
	}{
		{
			name: "Success",
			setupMocks: func(pr *mocks.PostRepository) {
				pr.On("FindAll", mock.Anything, 1, 10).Return(&domain.PaginatedPosts{}, nil)
			},
			wantErr: false,
		},
		{
			name: "Error",
			setupMocks: func(pr *mocks.PostRepository) {
				pr.On("FindAll", mock.Anything, 1, 10).Return(nil, errors.New("fail"))
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := new(mocks.PostRepository)
			ai := new(mocks.AIService)
			tt.setupMocks(pr)
			s := NewPostService(pr, nil, nil, ai)
			_, err := s.GetPosts(context.Background(), 1, 10)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestPostService_GetPostsByAuthor(t *testing.T) {
	tests := []struct {
		name       string
		authorID   string
		setupMocks func(*mocks.PostRepository)
		wantErr    bool
	}{
		{
			name:     "Success",
			authorID: "user1",
			setupMocks: func(pr *mocks.PostRepository) {
				pr.On("FindByAuthor", mock.Anything, "user1", 1, 10).Return(&domain.PaginatedPosts{}, nil)
			},
			wantErr: false,
		},
		{
			name:     "Error",
			authorID: "user1",
			setupMocks: func(pr *mocks.PostRepository) {
				pr.On("FindByAuthor", mock.Anything, "user1", 1, 10).Return(nil, errors.New("fail"))
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := new(mocks.PostRepository)
			ai := new(mocks.AIService)
			tt.setupMocks(pr)
			s := NewPostService(pr, nil, nil, ai)
			_, err := s.GetPostsByAuthor(context.Background(), tt.authorID, 1, 10)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestPostService_GetPostsByTag(t *testing.T) {
	tests := []struct {
		name       string
		tag        string
		setupMocks func(*mocks.PostRepository)
		wantErr    bool
	}{
		{
			name: "Success",
			tag:  "tech",
			setupMocks: func(pr *mocks.PostRepository) {
				pr.On("FindByTag", mock.Anything, "tech", 1, 10).Return(&domain.PaginatedPosts{}, nil)
			},
			wantErr: false,
		},
		{
			name: "Error",
			tag:  "tech",
			setupMocks: func(pr *mocks.PostRepository) {
				pr.On("FindByTag", mock.Anything, "tech", 1, 10).Return(nil, errors.New("fail"))
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := new(mocks.PostRepository)
			ai := new(mocks.AIService)
			tt.setupMocks(pr)
			s := NewPostService(pr, nil, nil, ai)
			_, err := s.GetPostsByTag(context.Background(), tt.tag, 1, 10)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
