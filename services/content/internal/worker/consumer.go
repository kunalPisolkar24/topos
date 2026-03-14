package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"regexp"
	"strings"
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

var htmlTagRegex = regexp.MustCompile(`<[^>]+>`)

func NewWorker(brokers []string, groupID string, topics []string, postService *service.PostService, aiService domain.AIService) (*Worker, error) {
	if len(brokers) == 0 {
		return nil, fmt.Errorf("kafka brokers are required")
	}
	if strings.TrimSpace(groupID) == "" {
		return nil, fmt.Errorf("kafka consumer group id is required")
	}
	if len(topics) == 0 {
		return nil, fmt.Errorf("kafka consumer topics are required")
	}

	var config kafka.ReaderConfig
	if len(topics) == 1 {
		config = kafka.ReaderConfig{
			Brokers:  brokers,
			GroupID:  groupID,
			Topic:    topics[0],
			MinBytes: 10e3,
			MaxBytes: 10e6,
		}
	} else {
		config = kafka.ReaderConfig{
			Brokers:     brokers,
			GroupID:     groupID,
			GroupTopics: topics,
			MinBytes:    10e3,
			MaxBytes:    10e6,
		}
	}

	reader := kafka.NewReader(config)

	return &Worker{
		reader:      reader,
		postService: postService,
		aiService:   aiService,
	}, nil
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

	if strings.TrimSpace(event.PostID) == "" {
		status = monitoring.StatusErr
		return fmt.Errorf("postID is missing")
	}

	logger.Info("Processing message", "postID", event.PostID)

	post, err := w.postService.GetPost(ctx, event.PostID)
	if err != nil {
		status = monitoring.StatusErr
		return fmt.Errorf("failed to fetch post: %w", err)
	}

	trimmedSummary := strings.TrimSpace(post.Summary)
	if trimmedSummary != "" {
		if post.SummaryStatus != "COMPLETED" && post.SummaryStatus != "FAILED" {
			if err := w.postService.SetPostSummary(ctx, post.ID, trimmedSummary, "COMPLETED"); err != nil {
				status = monitoring.StatusErr
				return fmt.Errorf("failed to update post summary: %w", err)
			}
			logger.Info("Summary already present, marking completed", "postID", post.ID)
			return nil
		}
		if post.SummaryStatus == "COMPLETED" {
			status = monitoring.StatusSkip
			return nil
		}
	}

	body := post.Body
	if strings.TrimSpace(body) == "" && strings.TrimSpace(event.Body) != "" {
		body = event.Body
	}

	cleanBody := stripHtml(body)
	if cleanBody == "" {
		summary := fallbackSummary(cleanBody)
		if err := w.postService.SetPostSummary(ctx, post.ID, summary, "COMPLETED"); err != nil {
			status = monitoring.StatusErr
			return fmt.Errorf("failed to update post summary: %w", err)
		}
		logger.Info("Generated fallback summary", "postID", post.ID)
		return nil
	}

	summary, err := w.aiService.GenerateSummary(ctx, cleanBody)
	if err != nil {
		status = monitoring.StatusErr
		fallback := fallbackSummary(cleanBody)
		if updateErr := w.postService.SetPostSummary(ctx, post.ID, fallback, "FAILED"); updateErr != nil {
			logger.Error("Failed to set summary status to FAILED", "error", updateErr, "postID", post.ID)
		}
		return fmt.Errorf("ai generation error: %w", err)
	}

	summary = strings.TrimSpace(summary)
	if summary == "" {
		summary = fallbackSummary(cleanBody)
	}
	if summary == "" {
		status = monitoring.StatusErr
		if updateErr := w.postService.SetPostSummary(ctx, post.ID, "", "FAILED"); updateErr != nil {
			logger.Error("Failed to set summary status to FAILED", "error", updateErr, "postID", post.ID)
		}
		return fmt.Errorf("empty summary generated")
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
	if strings.TrimSpace(input) == "" {
		return ""
	}
	decoded := html.UnescapeString(input)
	stripped := htmlTagRegex.ReplaceAllString(decoded, " ")
	return normalizeWhitespace(stripped)
}

func normalizeWhitespace(input string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(input)), " ")
}

func fallbackSummary(input string) string {
	normalized := normalizeWhitespace(input)
	if normalized == "" {
		return "Summary is currently unavailable."
	}
	return truncateText(normalized, 240)
}

func truncateText(input string, max int) string {
	if max <= 0 {
		return ""
	}
	runes := []rune(input)
	if len(runes) <= max {
		return input
	}
	cut := string(runes[:max])
	if idx := strings.LastIndex(cut, " "); idx > 0 {
		cut = cut[:idx]
	}
	return strings.TrimSpace(cut) + "..."
}
