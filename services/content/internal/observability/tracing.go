package observability

import (
	"context"
	"log/slog"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.30.0"
)

// normalizeOtelEndpoint converts the shared OTEL_EXPORTER_OTLP_ENDPOINT
// (HTTP base like http://otel-collector:4318, or bare host:port) to the
// host:port form otlptracegrpc needs. The collector serves gRPC on :4317
// and HTTP on :4318, so an :4318 endpoint is mapped to :4317.
func normalizeOtelEndpoint(endpoint string) string {
	e := strings.TrimSpace(endpoint)
	e = strings.TrimPrefix(e, "http://")
	e = strings.TrimPrefix(e, "https://")
	if i := strings.Index(e, "/"); i != -1 {
		e = e[:i]
	}
	if !strings.Contains(e, ":") {
		return e + ":4317"
	}
	if strings.HasSuffix(e, ":4318") {
		return strings.TrimSuffix(e, ":4318") + ":4317"
	}
	return e
}

// SetupTracing wires the OpenTelemetry SDK and exports spans over OTLP
// gRPC when an endpoint is configured. With an empty endpoint it leaves
// the no-op tracer in place so the services run fine without any trace
// backend. The returned shutdown function flushes pending spans.
func SetupTracing(ctx context.Context, endpoint, serviceName string) (func(context.Context) error, error) {
	if strings.TrimSpace(endpoint) == "" {
		slog.Info("tracing disabled: OTEL_EXPORTER_OTLP_ENDPOINT not set")
		return func(context.Context) error { return nil }, nil
	}

	exporter, err := otlptracegrpc.New(ctx, otlptracegrpc.WithEndpoint(normalizeOtelEndpoint(endpoint)), otlptracegrpc.WithInsecure())
	if err != nil {
		return nil, err
	}

	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(serviceName),
		)),
	)
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	slog.Info("tracing enabled", "endpoint", endpoint, "service", serviceName)
	return provider.Shutdown, nil
}
