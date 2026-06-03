package ai

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func init() {
	logger.Init()
}

type mockAIService struct {
	mock.Mock
}

func (m *mockAIService) GenerateSummary(ctx context.Context, content string) (string, error) {
	args := m.Called(ctx, content)
	return args.String(0), args.Error(1)
}

func (m *mockAIService) GenerateTags(ctx context.Context, title, body string) ([]string, error) {
	args := m.Called(ctx, title, body)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]string), args.Error(1)
}

func (m *mockAIService) GeneratePost(ctx context.Context, prompt string) (*domain.GeneratedPost, error) {
	args := m.Called(ctx, prompt)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.GeneratedPost), args.Error(1)
}

func (m *mockAIService) Close() error {
	args := m.Called()
	return args.Error(0)
}

func TestCircuitBreaker_ClosedToOpenOnFailures(t *testing.T) {
	primary := new(mockAIService)
	fallback := new(mockAIService)
	cb := newCircuitBreaker()
	cb.failureThreshold = 3
	cb.successThreshold = 1

	client := &resilientAIClient{primary: primary, fallback: fallback, cb: cb}

	primary.On("GenerateSummary", mock.Anything, "test").Return("", errors.New("fail"))
	fallback.On("GenerateSummary", mock.Anything, "test").Return("fallback", nil)

	for i := 0; i < 5; i++ {
		result, err := client.GenerateSummary(context.Background(), "test")
		assert.NoError(t, err)
		assert.Equal(t, "fallback", result)
	}

	cb.mu.RLock()
	assert.Equal(t, stateOpen, cb.state)
	cb.mu.RUnlock()

	primary.AssertNumberOfCalls(t, "GenerateSummary", 3)
}

func TestCircuitBreaker_OpenToHalfOpenAfterTimeout(t *testing.T) {
	primary := new(mockAIService)
	fallback := new(mockAIService)
	cb := newCircuitBreaker()
	cb.failureThreshold = 1
	cb.successThreshold = 1
	cb.resetTimeout = 50 * time.Millisecond

	client := &resilientAIClient{primary: primary, fallback: fallback, cb: cb}

	primary.On("GenerateSummary", mock.Anything, "test").Return("", errors.New("fail"))
	fallback.On("GenerateSummary", mock.Anything, "test").Return("fallback", nil)

	client.GenerateSummary(context.Background(), "test")

	cb.mu.RLock()
	assert.Equal(t, stateOpen, cb.state, "should be open after one failure")
	cb.mu.RUnlock()

	primary.AssertNumberOfCalls(t, "GenerateSummary", 1)

	time.Sleep(60 * time.Millisecond)

	primary.On("GenerateSummary", mock.Anything, "test").Return("success", nil).Once()

	result, err := client.GenerateSummary(context.Background(), "test")
	assert.NoError(t, err)
	assert.Equal(t, "success", result)

	cb.mu.RLock()
	assert.Equal(t, stateClosed, cb.state, "should be closed after success in half-open")
	cb.mu.RUnlock()
}

func TestCircuitBreaker_HalfOpenFailsBackToOpen(t *testing.T) {
	primary := new(mockAIService)
	fallback := new(mockAIService)
	cb := newCircuitBreaker()
	cb.failureThreshold = 1
	cb.successThreshold = 1
	cb.resetTimeout = 50 * time.Millisecond

	cb.setState(stateOpen)
	cb.lastFailureTime = time.Now().Add(-100 * time.Millisecond)

	client := &resilientAIClient{primary: primary, fallback: fallback, cb: cb}

	primary.On("GenerateSummary", mock.Anything, "test").Return("", errors.New("fail")).Once()
	fallback.On("GenerateSummary", mock.Anything, "test").Return("fallback", nil)

	result, err := client.GenerateSummary(context.Background(), "test")
	assert.NoError(t, err)
	assert.Equal(t, "fallback", result)

	cb.mu.RLock()
	assert.Equal(t, stateOpen, cb.state, "should be open after failure in half-open")
	cb.mu.RUnlock()
}

func TestCircuitBreaker_ShortCircuitsWhenOpen(t *testing.T) {
	primary := new(mockAIService)
	fallback := new(mockAIService)
	cb := newCircuitBreaker()
	cb.failureThreshold = 1
	cb.successThreshold = 1
	cb.resetTimeout = 1 * time.Hour

	cb.setState(stateOpen)
	cb.lastFailureTime = time.Now()

	client := &resilientAIClient{primary: primary, fallback: fallback, cb: cb}

	fallback.On("GenerateSummary", mock.Anything, "test").Return("fallback", nil)

	result, err := client.GenerateSummary(context.Background(), "test")
	assert.NoError(t, err)
	assert.Equal(t, "fallback", result)

	primary.AssertNotCalled(t, "GenerateSummary", mock.Anything, mock.Anything)
}

func TestCircuitBreaker_GenerateTagsFallback(t *testing.T) {
	primary := new(mockAIService)
	fallback := new(mockAIService)
	cb := newCircuitBreaker()
	cb.failureThreshold = 1
	cb.state = stateClosed

	client := &resilientAIClient{primary: primary, fallback: fallback, cb: cb}

	primary.On("GenerateTags", mock.Anything, "title", "body").Return(nil, errors.New("fail"))
	fallback.On("GenerateTags", mock.Anything, "title", "body").Return([]string{"tag1", "tag2"}, nil)

	tags, err := client.GenerateTags(context.Background(), "title", "body")
	assert.NoError(t, err)
	assert.Equal(t, []string{"tag1", "tag2"}, tags)

	cb.mu.RLock()
	assert.Equal(t, stateOpen, cb.state)
	cb.mu.RUnlock()
}

func TestCircuitBreaker_GeneratePostFallback(t *testing.T) {
	primary := new(mockAIService)
	fallback := new(mockAIService)
	cb := newCircuitBreaker()
	cb.failureThreshold = 1
	cb.state = stateClosed

	client := &resilientAIClient{primary: primary, fallback: fallback, cb: cb}

	primary.On("GeneratePost", mock.Anything, "prompt").Return(nil, errors.New("fail"))
	fallback.On("GeneratePost", mock.Anything, "prompt").Return(&domain.GeneratedPost{Title: "fallback"}, nil)

	post, err := client.GeneratePost(context.Background(), "prompt")
	assert.NoError(t, err)
	assert.Equal(t, "fallback", post.Title)

	cb.mu.RLock()
	assert.Equal(t, stateOpen, cb.state)
	cb.mu.RUnlock()
}

func TestCircuitBreaker_ConcurrentAccess(t *testing.T) {
	primary := new(mockAIService)
	fallback := new(mockAIService)
	cb := newCircuitBreaker()
	cb.failureThreshold = 3

	client := &resilientAIClient{primary: primary, fallback: fallback, cb: cb}

	primary.On("GenerateSummary", mock.Anything, "test").Return("", errors.New("fail"))
	fallback.On("GenerateSummary", mock.Anything, "test").Return("fallback", nil)

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := client.GenerateSummary(context.Background(), "test")
			assert.NoError(t, err)
		}()
	}
	wg.Wait()
}

func TestResilientClient_Close(t *testing.T) {
	primary := new(mockAIService)
	fallback := new(mockAIService)
	cb := newCircuitBreaker()

	client := &resilientAIClient{primary: primary, fallback: fallback, cb: cb}
	primary.On("Close").Return(nil)

	err := client.Close()
	assert.NoError(t, err)
	primary.AssertCalled(t, "Close")
}

func TestNoopClient_Close(t *testing.T) {
	client := NewNoopAIClient()
	err := client.Close()
	assert.NoError(t, err)
}

func TestResilientClient_RateLimitDoesNotOpenBreaker(t *testing.T) {
	primary := new(mockAIService)
	fallback := new(mockAIService)
	cb := newCircuitBreaker()
	cb.failureThreshold = 1

	client := &resilientAIClient{primary: primary, fallback: fallback, cb: cb}

	resourceExhausted := status.Error(codes.ResourceExhausted, "rate limited")

	primary.On("GenerateSummary", mock.Anything, "test").Return("", resourceExhausted)
	fallback.On("GenerateSummary", mock.Anything, "test").Return("fallback", nil)

	result, err := client.GenerateSummary(context.Background(), "test")
	assert.NoError(t, err)
	assert.Equal(t, "fallback", result)

	cb.mu.RLock()
	assert.Equal(t, stateClosed, cb.state, "breaker should remain closed after rate limit")
	cb.mu.RUnlock()
}

func TestResilientClient_UnavailableDoesOpenBreaker(t *testing.T) {
	primary := new(mockAIService)
	fallback := new(mockAIService)
	cb := newCircuitBreaker()
	cb.failureThreshold = 1

	client := &resilientAIClient{primary: primary, fallback: fallback, cb: cb}

	unavailable := status.Error(codes.Unavailable, "service down")

	primary.On("GenerateSummary", mock.Anything, "test").Return("", unavailable)
	fallback.On("GenerateSummary", mock.Anything, "test").Return("fallback", nil)

	result, err := client.GenerateSummary(context.Background(), "test")
	assert.NoError(t, err)
	assert.Equal(t, "fallback", result)

	cb.mu.RLock()
	assert.Equal(t, stateOpen, cb.state, "breaker should open after unavailable error")
	cb.mu.RUnlock()
}
