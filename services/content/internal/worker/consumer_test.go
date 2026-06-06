package worker

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain/mocks"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/service"
	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
	"github.com/segmentio/kafka-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func init() {
	logger.Init()
}

func TestWorker_processMessage(t *testing.T) {
	tests := []struct {
		name          string
		kafkaMsgValue interface{}
		setupMocks    func(*mocks.PostRepository, *mocks.AIService)
		expectedError bool
		assertNoAICall bool
	}{
		{
			name:          "EmptyMessage",
			kafkaMsgValue: nil,
			setupMocks:    func(pr *mocks.PostRepository, ai *mocks.AIService) {},
			expectedError: false,
			assertNoAICall: true,
		},
		{
			name:          "InvalidJSON",
			kafkaMsgValue: "invalid-json",
			setupMocks:    func(pr *mocks.PostRepository, ai *mocks.AIService) {},
			expectedError: true,
			assertNoAICall: true,
		},
		{
			name: "PostNotFound",
			kafkaMsgValue: domain.PostEventPayload{
				PostID: "post1",
			},
			setupMocks: func(pr *mocks.PostRepository, ai *mocks.AIService) {
				pr.On("FindByID", mock.Anything, "post1").Return(nil, errors.New("not found"))
			},
			expectedError: true,
			assertNoAICall: true,
		},
		{
			name: "SummaryAlreadyCompleted",
			kafkaMsgValue: domain.PostEventPayload{
				PostID: "post1",
			},
			setupMocks: func(pr *mocks.PostRepository, ai *mocks.AIService) {
				pr.On("FindByID", mock.Anything, "post1").Return(&domain.Post{
					ID:            "post1",
					SummaryStatus: "COMPLETED",
					Summary:       "Existing summary",
				}, nil)
			},
			expectedError: false,
			assertNoAICall: true,
		},
		{
			name: "SummaryAlreadyPresentPending",
			kafkaMsgValue: domain.PostEventPayload{
				PostID: "post1",
			},
			setupMocks: func(pr *mocks.PostRepository, ai *mocks.AIService) {
				pr.On("FindByID", mock.Anything, "post1").Return(&domain.Post{
					ID:            "post1",
					SummaryStatus: "PENDING",
					Summary:       "AI summary",
				}, nil)
				pr.On("UpdateSummary", mock.Anything, "post1", "AI summary", "COMPLETED").Return(nil)
			},
			expectedError: false,
			assertNoAICall: true,
		},
		{
			name: "AIGenerationError",
			kafkaMsgValue: domain.PostEventPayload{
				PostID: "post1",
				Body:   "Some long content",
			},
			setupMocks: func(pr *mocks.PostRepository, ai *mocks.AIService) {
				pr.On("FindByID", mock.Anything, "post1").Return(&domain.Post{
					ID:            "post1",
					Body:          "Some long content",
					SummaryStatus: "PENDING",
				}, nil)
				ai.On("GenerateSummary", mock.Anything, "Some long content").Return("", errors.New("ai error"))
				pr.On("UpdateSummary", mock.Anything, "post1", mock.Anything, "FAILED").Return(nil)
			},
			expectedError: true,
		},
		{
			name: "Success",
			kafkaMsgValue: domain.PostEventPayload{
				PostID: "post1",
				Body:   "Content",
			},
			setupMocks: func(pr *mocks.PostRepository, ai *mocks.AIService) {
				pr.On("FindByID", mock.Anything, "post1").Return(&domain.Post{
					ID:            "post1",
					Body:          "Content",
					SummaryStatus: "PENDING",
				}, nil)
				ai.On("GenerateSummary", mock.Anything, "Content").Return("Short Summary", nil)
				pr.On("UpdateSummary", mock.Anything, "post1", "Short Summary", "COMPLETED").Return(nil)
			},
			expectedError: false,
		},
		{
			name: "EmptyBody_MarksAsFailed",
			kafkaMsgValue: domain.PostEventPayload{
				PostID: "post1",
			},
			setupMocks: func(pr *mocks.PostRepository, ai *mocks.AIService) {
				pr.On("FindByID", mock.Anything, "post1").Return(&domain.Post{
					ID:            "post1",
					Body:          "<p></p>",
					SummaryStatus: "PENDING",
				}, nil)
				pr.On("UpdateSummary", mock.Anything, "post1", mock.Anything, "FAILED").Return(nil)
			},
			expectedError: false,
			assertNoAICall: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockPostRepo := new(mocks.PostRepository)
			mockAIService := new(mocks.AIService)
			mockTagRepo := new(mocks.TagRepository)
			mockEventProducer := new(mocks.EventProducer)

			tt.setupMocks(mockPostRepo, mockAIService)

			postService := service.NewPostService(mockPostRepo, mockTagRepo, mockEventProducer, mockAIService)

			w := &Worker{
				postService: postService,
				aiService:   mockAIService,
			}

			var valueBytes []byte
			if tt.kafkaMsgValue != nil {
				if str, ok := tt.kafkaMsgValue.(string); ok {
					valueBytes = []byte(str)
				} else {
					valueBytes, _ = json.Marshal(tt.kafkaMsgValue)
				}
			}

			msg := kafka.Message{
				Value: valueBytes,
			}

			err := w.processMessage(context.Background(), msg)

			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			if tt.assertNoAICall {
				mockAIService.AssertNotCalled(t, "GenerateSummary", mock.Anything, mock.Anything)
			}

			mockPostRepo.AssertExpectations(t)
			mockAIService.AssertExpectations(t)
		})
	}
}
