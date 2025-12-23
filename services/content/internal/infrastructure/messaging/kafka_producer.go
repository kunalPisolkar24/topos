package messaging

import (
	"context"
	"encoding/json"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/segmentio/kafka-go"
)

type kafkaProducer struct {
	writer *kafka.Writer
}

func NewKafkaProducer(brokers []string, topic string) domain.EventProducer {
	writer := &kafka.Writer{
		Addr:     kafka.TCP(brokers...),
		Topic:    topic,
		Balancer: &kafka.LeastBytes{},
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
		AuthorName: "Unknown",
		ImageURL:   post.ImageUrl,
		CreatedAt:  post.CreatedAt,
	}

	value, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	message := kafka.Message{
		Key:   []byte(post.ID),
		Value: value,
	}

	return k.writer.WriteMessages(ctx, message)
}