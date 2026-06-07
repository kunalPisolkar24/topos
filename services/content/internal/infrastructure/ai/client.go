package ai

import (
	"context"
	"sync"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
	pb "github.com/kunalPisolkar24/blogapp/services/content/proto/ai"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type circuitState int

const (
	stateClosed circuitState = iota
	stateOpen
	stateHalfOpen
)

type circuitBreaker struct {
	mu               sync.RWMutex
	state            circuitState
	failureCount     int
	successCount     int
	lastFailureTime  time.Time
	failureThreshold int
	successThreshold int
	resetTimeout     time.Duration
}

func newCircuitBreaker() *circuitBreaker {
	return &circuitBreaker{
		state:            stateClosed,
		failureThreshold: 5,
		successThreshold: 2,
		resetTimeout:     30 * time.Second,
	}
}

func (cb *circuitBreaker) canProceed() bool {
	cb.mu.RLock()
	switch cb.state {
	case stateClosed:
		cb.mu.RUnlock()
		return true
	case stateOpen:
		if time.Since(cb.lastFailureTime) > cb.resetTimeout {
			cb.mu.RUnlock()
			cb.mu.Lock()
			defer cb.mu.Unlock()
			if cb.state == stateOpen {
				cb.state = stateHalfOpen
				cb.successCount = 0
				logger.Info("AI Circuit Breaker entering HALF-OPEN state")
				return true
			}
			return cb.state != stateOpen
		}
		cb.mu.RUnlock()
		return false
	default:
		cb.mu.RUnlock()
		return true
	}
}

func (cb *circuitBreaker) recordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case stateHalfOpen:
		cb.successCount++
		if cb.successCount >= cb.successThreshold {
			cb.state = stateClosed
			cb.failureCount = 0
			logger.Info("AI Circuit Breaker reset to CLOSED")
		}
	case stateClosed:
		cb.failureCount = 0
	}
}

func (cb *circuitBreaker) recordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failureCount++
	cb.lastFailureTime = time.Now()

	switch cb.state {
	case stateClosed:
		if cb.failureCount >= cb.failureThreshold {
			cb.state = stateOpen
			logger.Warn("AI Circuit Breaker TRIPPED to OPEN")
		}
	case stateHalfOpen:
		cb.state = stateOpen
		logger.Warn("AI Circuit Breaker returned to OPEN from HALF-OPEN")
	}
}

type grpcAIClient struct {
	client pb.AIServiceClient
	conn   *grpc.ClientConn
}

type resilientAIClient struct {
	primary  domain.AIService
	fallback domain.AIService
	cb       *circuitBreaker
}

func NewAIClient(url string) (domain.AIService, error) {
	return newGRPCAIClient(url, 5*time.Second)
}

func NewResilientAIClient(url string, required bool, dialTimeout time.Duration) (domain.AIService, error) {
	fallback := NewNoopAIClient()
	primary, err := newGRPCAIClient(url, dialTimeout)
	if err != nil {
		if required {
			return nil, err
		}
		logger.Warn("AI service unavailable, using fallback mode", "error", err, "url", url)
		return fallback, nil
	}

	return &resilientAIClient{
		primary:  primary,
		fallback: fallback,
		cb:       newCircuitBreaker(),
	}, nil
}

func newGRPCAIClient(url string, dialTimeout time.Duration) (domain.AIService, error) {
	if dialTimeout <= 0 {
		dialTimeout = 5 * time.Second
	}

	ctx, cancel := context.WithTimeout(context.Background(), dialTimeout)
	defer cancel()

	conn, err := grpc.DialContext(ctx, url,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, err
	}

	return &grpcAIClient{
		client: pb.NewAIServiceClient(conn),
		conn:   conn,
	}, nil
}

func (c *resilientAIClient) GenerateSummary(ctx context.Context, content string) (string, error) {
	if c.cb.canProceed() {
		summary, err := c.primary.GenerateSummary(ctx, content)
		if err == nil {
			c.cb.recordSuccess()
			return summary, nil
		}
		c.cb.recordFailure()
		logger.Warn("AI summary generation failed, using fallback", "error", err)
	}
	return c.fallback.GenerateSummary(ctx, content)
}

func (c *resilientAIClient) GenerateTags(ctx context.Context, title, body string) ([]string, error) {
	if c.cb.canProceed() {
		tags, err := c.primary.GenerateTags(ctx, title, body)
		if err == nil {
			c.cb.recordSuccess()
			return tags, nil
		}
		c.cb.recordFailure()
		logger.Warn("AI tags generation failed, using fallback", "error", err)
	}
	return c.fallback.GenerateTags(ctx, title, body)
}

func (c *resilientAIClient) GeneratePost(ctx context.Context, prompt string) (*domain.GeneratedPost, error) {
	if c.cb.canProceed() {
		post, err := c.primary.GeneratePost(ctx, prompt)
		if err == nil {
			c.cb.recordSuccess()
			return post, nil
		}
		c.cb.recordFailure()
		logger.Warn("AI post generation failed, using fallback", "error", err)
	}
	return c.fallback.GeneratePost(ctx, prompt)
}

func (c *resilientAIClient) Close() error {
	if err := c.primary.Close(); err != nil {
		logger.Warn("Failed to close primary AI client", "error", err)
	}
	if err := c.fallback.Close(); err != nil {
		logger.Warn("Failed to close fallback AI client", "error", err)
	}
	return nil
}

func (c *grpcAIClient) GenerateSummary(ctx context.Context, content string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	req := &pb.ContentRequest{
		Text: content,
	}

	resp, err := c.client.GenerateSummary(ctx, req)
	if err != nil {
		return "", err
	}

	return resp.Summary, nil
}

func (c *grpcAIClient) GenerateTags(ctx context.Context, title, body string) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	req := &pb.ContextRequest{
		Title: title,
		Body:  body,
	}

	resp, err := c.client.GenerateTags(ctx, req)
	if err != nil {
		return nil, err
	}

	return resp.Tags, nil
}

func (c *grpcAIClient) GeneratePost(ctx context.Context, prompt string) (*domain.GeneratedPost, error) {
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	req := &pb.PostGenerationRequest{
		Prompt: prompt,
	}

	resp, err := c.client.GeneratePost(ctx, req)
	if err != nil {
		return nil, err
	}

	return &domain.GeneratedPost{
		Title:   resp.Title,
		Body:    resp.Body,
		Summary: resp.Summary,
		Tags:    resp.Tags,
	}, nil
}

func (c *grpcAIClient) Close() error {
	return c.conn.Close()
}
