package worker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/kunalPisolkar24/topos/services/content/internal/domain"
	"github.com/kunalPisolkar24/topos/services/content/internal/metrics"
	"github.com/segmentio/kafka-go"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Worker consumes post events from Kafka and generates summaries.
type Worker struct {
	*baseRunner
	processor domain.SummaryProcessor
}

func NewWorker(brokers []string, groupID string, topics []string, dlqTopic string, concurrency int, processor domain.SummaryProcessor, aiService domain.AIService, producer domain.DLQPublisher) (*Worker, error) {
	base, err := newBaseRunner(brokers, groupID, topics, dlqTopic, concurrency, aiService, producer)
	if err != nil {
		return nil, err
	}
	return &Worker{baseRunner: base, processor: processor}, nil
}

func (w *Worker) Start(ctx context.Context) {
	w.baseRunner.start(ctx, w.processMessage)
}

func (w *Worker) processWithRetries(ctx context.Context, _ *kafka.Reader, m kafka.Message) error {
	return w.baseRunner.processWithRetries(ctx, m, w.processMessage)
}

func (w *Worker) sendToDLQ(ctx context.Context, _ *kafka.Reader, m kafka.Message, cause error) error {
	return w.baseRunner.sendToDLQ(ctx, m, cause)
}

func (w *Worker) processMessage(ctx context.Context, m kafka.Message) error {
	if len(m.Value) == 0 {
		slog.Debug("skipping tombstone", "partition", m.Partition, "offset", m.Offset)
		metrics.WorkerMessagesTotal.WithLabelValues("skipped").Inc()
		return nil
	}

	var event domain.PostEventPayload
	if err := json.Unmarshal(m.Value, &event); err != nil {
		return permanentf("unmarshal event: %w", err)
	}
	if strings.TrimSpace(event.PostID) == "" {
		return permanentf("event is missing postId")
	}

	ctx, span := workerTracer.Start(ctx, "process message",
		trace.WithAttributes(
			attribute.String("post.id", event.PostID),
			attribute.Int("kafka.partition", m.Partition),
			attribute.Int64("kafka.offset", m.Offset),
		),
	)
	defer span.End()

	slog.Info("processing message", "postID", event.PostID, "partition", m.Partition, "offset", m.Offset)

	post, err := w.processor.GetPost(ctx, event.PostID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			slog.Info("post no longer exists, skipping", "postID", event.PostID)
			metrics.WorkerMessagesTotal.WithLabelValues("skipped").Inc()
			return nil
		}
		return fmt.Errorf("fetch post: %w", err)
	}

	if strings.TrimSpace(post.Summary) != "" && post.SummaryStatus == domain.PostStatusCompleted {
		slog.Info("summary already completed, skipping", "postID", post.ID)
		metrics.WorkerMessagesTotal.WithLabelValues("skipped").Inc()
		return nil
	}

	body := post.Body
	if strings.TrimSpace(body) == "" && strings.TrimSpace(event.Body) != "" {
		body = event.Body
	}

	cleanBody := stripHTML(body)
	if cleanBody == "" {
		slog.Warn("post has no usable body, marking summary failed", "postID", post.ID)
		err := w.processor.SetPostSummary(ctx, post.ID, "", domain.PostStatusFailed)
		metrics.WorkerMessagesTotal.WithLabelValues("failed").Inc()
		return err
	}

	summary, err := w.aiService.GenerateSummary(ctx, cleanBody)
	if err != nil {
		slog.Warn("ai summary generation failed", "postID", post.ID, "error", err)
		if updateErr := w.processor.SetPostSummary(ctx, post.ID, "", domain.PostStatusFailed); updateErr != nil {
			slog.Error("failed to mark summary failed", "error", updateErr, "postID", post.ID)
		}
		return err
	}

	summary = strings.TrimSpace(summary)
	if summary == "" {
		slog.Warn("ai returned an empty summary, marking failed", "postID", post.ID)
		if updateErr := w.processor.SetPostSummary(ctx, post.ID, "", domain.PostStatusFailed); updateErr != nil {
			slog.Error("failed to mark summary failed", "error", updateErr, "postID", post.ID)
		}
		return errors.New("ai returned an empty summary")
	}

	if err := w.processor.SetPostSummary(ctx, post.ID, summary, domain.PostStatusCompleted); err != nil {
		return fmt.Errorf("update post summary: %w", err)
	}

	metrics.WorkerMessagesTotal.WithLabelValues("completed").Inc()
	slog.Info("summary generated", "postID", post.ID)
	return nil
}
