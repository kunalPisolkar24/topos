package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/kunalPisolkar24/topos/services/content/internal/domain"
	"github.com/kunalPisolkar24/topos/services/content/internal/metrics"
	"github.com/segmentio/kafka-go"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type PersonalizerWorker struct {
	*baseRunner
}

func NewPersonalizerWorker(brokers []string, groupID string, topics []string, dlqTopic string, concurrency int, aiService domain.AIService, producer domain.DLQPublisher) (*PersonalizerWorker, error) {
	base, err := newBaseRunner(brokers, groupID, topics, dlqTopic, concurrency, aiService, producer)
	if err != nil {
		return nil, err
	}
	return &PersonalizerWorker{baseRunner: base}, nil
}

func (w *PersonalizerWorker) Start(ctx context.Context) {
	w.baseRunner.start(ctx, w.processMessage)
}

func (w *PersonalizerWorker) processWithRetries(ctx context.Context, m kafka.Message) error {
	return w.baseRunner.processWithRetries(ctx, m, w.processMessage)
}

func (w *PersonalizerWorker) sendToDLQ(ctx context.Context, m kafka.Message, cause error) error {
	return w.baseRunner.sendToDLQ(ctx, m, cause)
}

func (w *PersonalizerWorker) processMessage(ctx context.Context, m kafka.Message) error {
	if len(m.Value) == 0 {
		slog.Debug("skipping tombstone", "partition", m.Partition, "offset", m.Offset)
		metrics.WorkerMessagesTotal.WithLabelValues("skipped").Inc()
		return nil
	}

	var payload domain.UserInteractedPayload
	if err := json.Unmarshal(m.Value, &payload); err != nil {
		return permanentf("unmarshal interaction: %w", err)
	}
	if strings.TrimSpace(payload.UserID) == "" || strings.TrimSpace(payload.PostID) == "" {
		return permanentf("interaction is missing userId or postId")
	}

	ctx, span := personalizerWorkerTracer.Start(ctx, "update user profile",
		trace.WithAttributes(
			attribute.String("user.id", payload.UserID),
			attribute.String("post.id", payload.PostID),
			attribute.Int("kafka.partition", m.Partition),
			attribute.Int64("kafka.offset", m.Offset),
		),
	)
	defer span.End()

	if err := w.aiService.UpdateUserProfile(ctx, payload.UserID, payload.PostID, payload.Kind, payload.Mode); err != nil {
		return fmt.Errorf("update user profile: %w", err)
	}

	slog.Info("user profile updated", "userID", payload.UserID, "postID", payload.PostID, "kind", payload.Kind)
	metrics.WorkerMessagesTotal.WithLabelValues("completed").Inc()
	return nil
}
