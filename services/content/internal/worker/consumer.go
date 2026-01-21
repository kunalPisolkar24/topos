package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/monitoring"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/service"
	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
	"github.com/segmentio/kafka-go"
)

type Worker struct {
	reader      *kafka.Reader
	postService *service.PostService
	aiService   domain.AIService
}

func NewWorker(brokers []string, topic string, postService *service.PostService, aiService domain.AIService) *Worker {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  brokers,
		GroupID:  "content-summary-worker-group",
		Topic:    topic,
		MinBytes: 10e3,
		MaxBytes: 10e6,
	})

	return &Worker{
		reader:      reader,
		postService: postService,
		aiService:   aiService,
	}
}

func (w *Worker) Start(ctx context.Context) {
	logger.Info("Starting Kafka Consumer Worker")

	for {
		select {
		case <-ctx.Done():
			logger.Info("Worker context cancelled, stopping...")
			return
		default:
			m, err := w.reader.FetchMessage(ctx)
			if err != nil {
				if err == io.EOF {
					return
				}
				logger.Error("Failed to fetch message", "error", err)
				continue
			}

			if err := w.processMessage(ctx, m); err != nil {
				logger.Error("Failed to process message",
					"error", err,
					"offset", m.Offset,
					"partition", m.Partition,
				)
			} else {
				if err := w.reader.CommitMessages(ctx, m); err != nil {
					logger.Error("Failed to commit message", "error", err)
				}
			}
		}
	}
}

func (w *Worker) processMessage(ctx context.Context, m kafka.Message) error {
	start := time.Now()
	status := monitoring.StatusOk
	
	defer func() {
		duration := time.Since(start).Seconds()
		monitoring.WorkerJobDuration.WithLabelValues(monitoring.JobGenerate).Observe(duration)
		monitoring.WorkerJobsProcessed.WithLabelValues(monitoring.JobGenerate, status).Inc()
	}()

	if len(m.Value) == 0 {
		status = monitoring.StatusSkip
		return nil
	}

	var event domain.PostEventPayload
	if err := json.Unmarshal(m.Value, &event); err != nil {
		status = monitoring.StatusErr
		return fmt.Errorf("unmarshal error: %w", err)
	}

	logger.Info("Processing message", "postID", event.PostID)

	post, err := w.postService.GetPost(ctx, event.PostID)
	if err != nil {
		status = monitoring.StatusErr
		return fmt.Errorf("failed to fetch post: %w", err)
	}

	if post.SummaryStatus == "COMPLETED" && post.Summary != "" {
		status = monitoring.StatusSkip
		return nil
	}

	cleanBody := stripHtml(post.Body)
	summary, err := w.aiService.GenerateSummary(ctx, cleanBody)
	if err != nil {
		status = monitoring.StatusErr
		if updateErr := w.postService.SetPostSummary(ctx, post.ID, "", "FAILED"); updateErr != nil {
			logger.Error("Failed to set summary status to FAILED", "error", updateErr, "postID", post.ID)
		}
		return fmt.Errorf("ai generation error: %w", err)
	}

	if err := w.postService.SetPostSummary(ctx, post.ID, summary, "COMPLETED"); err != nil {
		status = monitoring.StatusErr
		return fmt.Errorf("failed to update post summary: %w", err)
	}

	logger.Info("Successfully generated summary", "postID", post.ID)
	return nil
}

func (w *Worker) Close() error {
	return w.reader.Close()
}

func stripHtml(input string) string {
	return input
}