//go:build integration

package testhelpers

import (
	"context"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
)

type NoopEventProducer struct{}

func (NoopEventProducer) PublishPostCreated(_ context.Context, _ *domain.Post) error {
	return nil
}

func (NoopEventProducer) PublishPostUpdated(_ context.Context, _ *domain.Post) error {
	return nil
}

func (NoopEventProducer) PublishPostDeleted(_ context.Context, _ string) error {
	return nil
}

func (NoopEventProducer) PublishDeadLetter(_ context.Context, _, _ string, _, _ []byte, _ error) error {
	return nil
}

func (NoopEventProducer) Ping(_ context.Context) error {
	return nil
}

func (NoopEventProducer) Close() error {
	return nil
}
