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

type SearchWorker struct {
	*baseRunner
}

func NewSearchWorker(brokers []string, groupID string, topics []string, dlqTopic string, concurrency int, aiService domain.AIService, producer domain.DLQPublisher) (*SearchWorker, error) {
	base, err := newBaseRunner(brokers, groupID, topics, dlqTopic, concurrency, aiService, producer)
	if err != nil {
		return nil, err
	}
	return &SearchWorker{baseRunner: base}, nil
}

func (w *SearchWorker) Start(ctx context.Context) {
	w.baseRunner.start(ctx, w.processMessage)
}

func (w *SearchWorker) processWithRetries(ctx context.Context, m kafka.Message) error {
	return w.baseRunner.processWithRetries(ctx, m, w.processMessage)
}

func (w *SearchWorker) sendToDLQ(ctx context.Context, m kafka.Message, cause error) error {
	return w.baseRunner.sendToDLQ(ctx, m, cause)
}

func (w *SearchWorker) processMessage(ctx context.Context, m kafka.Message) error {
	if len(m.Value) == 0 {
		postID := string(m.Key)
		if postID == "" {
			slog.Warn("tombstone without key, skipping", "partition", m.Partition, "offset", m.Offset)
			metrics.WorkerMessagesTotal.WithLabelValues("skipped").Inc()
			return nil
		}

		ctx, span := searchWorkerTracer.Start(ctx, "delete from index",
			trace.WithAttributes(
				attribute.String("post.id", postID),
				attribute.Int("kafka.partition", m.Partition),
				attribute.Int64("kafka.offset", m.Offset),
			),
		)
		defer span.End()

		if err := w.aiService.DeletePost(ctx, postID); err != nil {
			return fmt.Errorf("delete post from index: %w", err)
		}
		slog.Info("post deleted from search index", "postID", postID)
		metrics.WorkerMessagesTotal.WithLabelValues("completed").Inc()
		return nil
	}

	var event domain.PostEventPayload
	if err := json.Unmarshal(m.Value, &event); err != nil {
		return permanentf("unmarshal event: %w", err)
	}
	if strings.TrimSpace(event.PostID) == "" {
		return permanentf("event is missing postId")
	}

	ctx, span := searchWorkerTracer.Start(ctx, "index post",
		trace.WithAttributes(
			attribute.String("post.id", event.PostID),
			attribute.Int("kafka.partition", m.Partition),
			attribute.Int64("kafka.offset", m.Offset),
		),
	)
	defer span.End()

	if err := w.aiService.IndexPost(
		ctx, event.PostID, event.Title, event.Body, event.Summary, event.Tags, event.CreatedAt,
	); err != nil {
		return fmt.Errorf("index post: %w", err)
	}

	slog.Info("post indexed", "postID", event.PostID)
	metrics.WorkerMessagesTotal.WithLabelValues("completed").Inc()
	return nil
}
