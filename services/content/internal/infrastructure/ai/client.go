package ai

import (
	"context"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
	pb "github.com/kunalPisolkar24/blogapp/services/content/proto/ai"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type grpcAIClient struct {
	client pb.AIServiceClient
	conn   *grpc.ClientConn
}

type resilientAIClient struct {
	primary  domain.AIService
	fallback domain.AIService
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
	summary, err := c.primary.GenerateSummary(ctx, content)
	if err == nil {
		return summary, nil
	}
	logger.Warn("AI summary generation failed, using fallback", "error", err)
	return c.fallback.GenerateSummary(ctx, content)
}

func (c *resilientAIClient) GenerateTags(ctx context.Context, title, body string) ([]string, error) {
	tags, err := c.primary.GenerateTags(ctx, title, body)
	if err == nil {
		return tags, nil
	}
	logger.Warn("AI tags generation failed, using fallback", "error", err)
	return c.fallback.GenerateTags(ctx, title, body)
}

func (c *resilientAIClient) GeneratePost(ctx context.Context, prompt string) (*domain.GeneratedPost, error) {
	post, err := c.primary.GeneratePost(ctx, prompt)
	if err == nil {
		return post, nil
	}
	logger.Warn("AI post generation failed, using fallback", "error", err)
	return c.fallback.GeneratePost(ctx, prompt)
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
