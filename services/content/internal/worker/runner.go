package worker

import (
	"context"
	"errors"
	"fmt"
	"html"
	"log/slog"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/kunalPisolkar24/topos/services/content/internal/domain"
	"github.com/kunalPisolkar24/topos/services/content/internal/metrics"
	"github.com/segmentio/kafka-go"
	"go.opentelemetry.io/otel"
)

const (
	maxRetries = 5
	retryBase  = 5 * time.Second

	lagReportInterval = 15 * time.Second
	dlqRetryDelay     = 2 * time.Second
)

var (
	htmlTagRegex = regexp.MustCompile(`<[^>]+>`)
	workerTracer = otel.Tracer("content-worker")
	searchWorkerTracer = otel.Tracer("content-search-worker")
	personalizerWorkerTracer = otel.Tracer("content-personalizer")
)

type permanentError struct{ error }

func permanentf(format string, args ...any) error {
	return permanentError{fmt.Errorf(format, args...)}
}

func isPermanent(err error) bool {
	var permanent permanentError
	return errors.As(err, &permanent)
}

func sleep(ctx context.Context, d time.Duration) bool {
	select {
	case <-ctx.Done():
		return false
	case <-time.After(d):
		return true
	}
}

func stripHTML(input string) string {
	if strings.TrimSpace(input) == "" {
		return ""
	}
	decoded := html.UnescapeString(input)
	stripped := htmlTagRegex.ReplaceAllString(decoded, " ")
	return strings.Join(strings.Fields(strings.TrimSpace(stripped)), " ")
}

// baseRunner holds the common Kafka consumer machinery.
type baseRunner struct {
	readers   []*kafka.Reader
	producer  domain.DLQPublisher
	dlqTopic  string
	aiService domain.AIService

	maxRetries int
	retryBase  time.Duration

	running atomic.Bool
	done    chan struct{}
}

func newBaseRunner(brokers []string, groupID string, topics []string, dlqTopic string, concurrency int, aiService domain.AIService, producer domain.DLQPublisher) (*baseRunner, error) {
	if len(brokers) == 0 {
		return nil, errors.New("kafka brokers are required")
	}
	if strings.TrimSpace(groupID) == "" {
		return nil, errors.New("kafka consumer group id is required")
	}
	if len(topics) == 0 {
		return nil, errors.New("kafka consumer topics are required")
	}
	if concurrency < 1 {
		concurrency = 1
	}
	b := &baseRunner{
		producer:   producer,
		dlqTopic:   dlqTopic,
		aiService:  aiService,
		maxRetries: maxRetries,
		retryBase:  retryBase,
		done:       make(chan struct{}),
	}
	for range concurrency {
		b.readers = append(b.readers, kafka.NewReader(kafka.ReaderConfig{
			Brokers:     brokers,
			GroupID:     groupID,
			GroupTopics: topics,
			MinBytes:    1,
			MaxBytes:    10e6,
			MaxWait:     2 * time.Second,
		}))
	}
	return b, nil
}

func (b *baseRunner) reportLag(ctx context.Context) {
	ticker := time.NewTicker(lagReportInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			for i, reader := range b.readers {
				metrics.WorkerLag.WithLabelValues(strconv.Itoa(i)).Set(float64(reader.Stats().Lag))
			}
		}
	}
}

func (b *baseRunner) processWithRetries(ctx context.Context, m kafka.Message, process func(context.Context, kafka.Message) error) error {
	var processErr error
	for attempt := 1; attempt <= b.maxRetries; attempt++ {
		processErr = process(ctx, m)
		if processErr == nil {
			return nil
		}
		if isPermanent(processErr) || errors.Is(processErr, domain.ErrAICircuitOpen) {
			return processErr
		}
		slog.Warn("message processing failed, retrying",
			"error", processErr,
			"attempt", attempt,
			"maxRetries", b.maxRetries,
			"offset", m.Offset,
			"partition", m.Partition,
		)
		metrics.WorkerRetriesTotal.Inc()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(attempt) * b.retryBase):
		}
	}
	return processErr
}

func (b *baseRunner) sendToDLQ(ctx context.Context, m kafka.Message, cause error) error {
	slog.Error("message failed after all retries, sending to dlq",
		"error", cause,
		"offset", m.Offset,
		"partition", m.Partition,
		"dlqTopic", b.dlqTopic,
	)
	metrics.WorkerMessagesTotal.WithLabelValues("dlq").Inc()
	if b.producer == nil {
		return nil
	}
	if err := b.producer.PublishDeadLetter(ctx, m.Topic, b.dlqTopic, m.Key, m.Value, cause); err != nil {
		slog.Error("failed to publish to dlq", "error", err)
		return err
	}
	return nil
}

func (b *baseRunner) consume(ctx context.Context, process func(context.Context, kafka.Message) error) {
	for {
		// Find a reader to fetch from (round-robin via the base's readers).
		// This is called per-reader goroutine, so we just need to fetch from that reader.
		// The actual per-reader consume is handled by the outer Start loop.
		// This helper is not used directly; each worker's Start creates its own per-reader loop.
		// Kept for symmetry, but the real consume loops are in the worker-specific files.
		_ = process
		return
	}
}

func (b *baseRunner) Close() error {
	var errs []error
	for _, reader := range b.readers {
		if err := reader.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (b *baseRunner) Done() <-chan struct{} { return b.done }
func (b *baseRunner) Running() error {
	if b.running.Load() {
		return nil
	}
	return errors.New("worker is not running")
}
func (b *baseRunner) Healthy(ctx context.Context) error {
	if err := b.Running(); err != nil {
		return err
	}
	return b.aiService.Health(ctx)
}

func (b *baseRunner) start(ctx context.Context, process func(context.Context, kafka.Message) error) {
	defer close(b.done)
	b.running.Store(true)
	defer b.running.Store(false)

	go b.reportLag(ctx)

	var wg sync.WaitGroup
	for _, reader := range b.readers {
		wg.Add(1)
		go func(reader *kafka.Reader) {
			defer wg.Done()
			for {
				m, err := reader.FetchMessage(ctx)
				if err != nil {
					if ctx.Err() != nil {
						return
					}
					slog.Error("failed to fetch message", "error", err)
					continue
				}
				processErr := b.processWithRetries(ctx, m, process)
				if processErr != nil && ctx.Err() == nil {
					if err := b.sendToDLQ(ctx, m, processErr); err != nil {
						slog.Error("dlq publish failed, leaving offset uncommitted", "error", err, "offset", m.Offset, "partition", m.Partition)
						metrics.WorkerMessagesTotal.WithLabelValues("dlq_failed").Inc()
						if !sleep(ctx, dlqRetryDelay) {
							return
						}
						continue
					}
				}
				if err := reader.CommitMessages(ctx, m); err != nil {
					slog.Error("failed to commit message", "error", err, "offset", m.Offset, "partition", m.Partition)
				}
			}
		}(reader)
	}
	wg.Wait()
}


