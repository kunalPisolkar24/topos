package ai

import (
	"context"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	pb "github.com/kunalPisolkar24/blogapp/services/content/proto/ai"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type grpcAIClient struct {
	client pb.AIServiceClient
	conn   *grpc.ClientConn
}

func NewAIClient(url string) (domain.AIService, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
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