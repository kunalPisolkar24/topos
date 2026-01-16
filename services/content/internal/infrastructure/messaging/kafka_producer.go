package messaging

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
	"github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/compress"
)

type kafkaProducer struct {
	writer *kafka.Writer
}

func NewKafkaProducer(brokers []string, topic string) domain.EventProducer {
	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        topic,
		Balancer:     &kafka.Hash{},
		MaxAttempts:  10,
		BatchSize:    100,
		BatchTimeout: 10 * time.Millisecond,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		RequiredAcks: kafka.RequireAll,
		Compression:  compress.Snappy,
		Logger: kafka.LoggerFunc(func(msg string, args ...interface{}) {
			logger.Info(fmt.Sprintf("Kafka Producer: "+msg, args...))
		}),
		ErrorLogger: kafka.LoggerFunc(func(msg string, args ...interface{}) {
			logger.Error(fmt.Sprintf("Kafka Producer Error: "+msg, args...))
		}),
	}
	return &kafkaProducer{writer: writer}
}

func (k *kafkaProducer) PublishPostCreated(ctx context.Context, post *domain.Post) error {
	return k.publish(ctx, post)
}

func (k *kafkaProducer) PublishPostUpdated(ctx context.Context, post *domain.Post) error {
	return k.publish(ctx, post)
}

func (k *kafkaProducer) PublishPostDeleted(ctx context.Context, id string) error {
	message := kafka.Message{
		Key:   []byte(id),
		Value: nil,
		Time:  time.Now(),
	}
	return k.writer.WriteMessages(ctx, message)
}

func (k *kafkaProducer) Close() error {
	return k.writer.Close()
}

func (k *kafkaProducer) publish(ctx context.Context, post *domain.Post) error {
	payload := domain.PostEventPayload{
		PostID:     post.ID,
		Title:      post.Title,
		Body:       post.Body,
		ImageURL:   post.ImageUrl,
		CreatedAt:  post.CreatedAt,
	}

	value, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal kafka payload: %w", err)
	}

	message := kafka.Message{
		Key:   []byte(post.ID),
		Value: value,
		Time:  time.Now(),
	}

	return k.writer.WriteMessages(ctx, message)
}