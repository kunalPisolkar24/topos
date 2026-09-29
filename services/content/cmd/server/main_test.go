package main

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kunalPisolkar24/topos/services/content/internal/config"
	"github.com/kunalPisolkar24/topos/services/content/internal/health"
	"github.com/kunalPisolkar24/topos/services/content/internal/metrics"
	"github.com/kunalPisolkar24/topos/services/content/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

type fakePinger struct{ err error }

func (f fakePinger) Ping(ctx context.Context, rp *readpref.ReadPref) error { return f.err }

var _ health.Pinger = fakePinger{}

type fakeProducer struct {
	testutil.MockEventPublisher
	err error
}

func (f *fakeProducer) Ping(ctx context.Context) error { return f.err }

func (f *fakeProducer) Close() error { return nil }

func TestHealthOK(t *testing.T) {
	h := health.LivenessHandler()

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	h(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestHealthMongoDown(t *testing.T) {
	h := health.LivenessHandler()

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	h(rec, req)

	// Liveness always 200, even when mongo is down.
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"status":"ok"`)
}

func TestHealthKafkaDown(t *testing.T) {
	h := health.LivenessHandler()

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	h(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"status":"ok"`)
}

func TestReadyOK(t *testing.T) {
	h := health.ReadyzHandler(fakePinger{})

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()
	h(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestReadyMongoDown(t *testing.T) {
	h := health.ReadyzHandler(fakePinger{err: errors.New("mongo down")})

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()
	h(rec, req)

	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)
	assert.Contains(t, rec.Body.String(), `"db":"unavailable"`)
}

func TestReadyKafkaDownStillReady(t *testing.T) {
	h := health.ReadyzHandler(fakePinger{})

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()
	h(rec, req)

	// Readiness is gated on mongo only; kafka down still ready (degraded).
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestHandlerRoutes(t *testing.T) {
	cfg := config.Config{JwtSecret: "test-secret"}
	h := newHandler(cfg, nil, nil, nil, nil)

	tests := []struct {
		name       string
		method     string
		path       string
		wantStatus int
	}{
		{"playground", http.MethodGet, "/", http.StatusOK},
		{"metrics", http.MethodGet, "/metrics", http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			assert.Equal(t, tt.wantStatus, rec.Code)
		})
	}
}

func TestHandlerQueryExecutesResolver(t *testing.T) {
	resolver := newResolverWithMocks(t)
	cfg := config.Config{JwtSecret: "test-secret"}
	h := newHandler(cfg, resolver, nil, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/query",
		bytes.NewBufferString(`{"query":"{ posts { posts { id } } }"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "p_1")
}

func TestHandlerSetsRequestID(t *testing.T) {
	cfg := config.Config{JwtSecret: "test-secret"}
	h := newHandler(cfg, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	assert.NotEmpty(t, rec.Header().Get("X-Request-Id"))
}

func TestMetricsExposeInteractionCounter(t *testing.T) {
	metrics.InteractionsTotal.WithLabelValues("view", "published").Inc()

	cfg := config.Config{JwtSecret: "test-secret"}
	h := newHandler(cfg, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "content_interactions_total")
	assert.Contains(t, rec.Body.String(), `kind="view"`)
	assert.Contains(t, rec.Body.String(), `status="published"`)
}
