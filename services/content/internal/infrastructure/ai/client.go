package ai

import (
	"context"
	"time"

	pb "github.com/kunalPisolkar24/blogapp/services/content/proto/ai"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type grpcAIClient struct {
	client pb.AIServiceClient
	conn   *grpc.ClientConn
}

func NewAIClient(url string) (*grpcAIClient, error) {
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
	req := &pb.ContentRequest{
		Text: content,
	}

	resp, err := c.client.GenerateSummary(ctx, req)
	if err != nil {
		return "", err
	}

	return resp.Summary, nil
}

func (c *grpcAIClient) Close() error {
	return c.conn.Close()
}