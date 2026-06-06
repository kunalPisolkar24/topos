package messaging

import (
	"context"
	"net"
	"testing"
	"time"
)

func TestKafkaProducer_Ping_NoBrokers(t *testing.T) {
	p := &kafkaProducer{brokers: nil}

	err := p.Ping(context.Background())
	if err == nil {
		t.Fatal("expected error when no brokers configured, got nil")
	}
}

func TestKafkaProducer_Ping_Reachable(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to open test listener: %v", err)
	}
	defer listener.Close()

	done := make(chan struct{})
	go func() {
		defer close(done)
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		_ = conn.Close()
	}()

	p := &kafkaProducer{brokers: []string{listener.Addr().String()}}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := p.Ping(ctx); err != nil {
		t.Errorf("expected Ping to succeed against open listener, got %v", err)
	}

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Error("expected listener to receive the ping connection")
	}
}

func TestKafkaProducer_Ping_Unreachable(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to open test listener: %v", err)
	}
	addr := listener.Addr().String()
	listener.Close()

	p := &kafkaProducer{brokers: []string{addr}}

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	if err := p.Ping(ctx); err == nil {
		t.Error("expected Ping to fail against closed listener, got nil")
	}
}

func TestKafkaProducer_Ping_ContextCanceled(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to open test listener: %v", err)
	}
	defer listener.Close()

	p := &kafkaProducer{brokers: []string{listener.Addr().String()}}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if err := p.Ping(ctx); err == nil {
		t.Error("expected Ping to fail when context is canceled, got nil")
	}
}
