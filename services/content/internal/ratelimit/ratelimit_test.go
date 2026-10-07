package ratelimit

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kunalPisolkar24/topos/services/content/internal/config"
	"github.com/kunalPisolkar24/topos/services/content/internal/middleware"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLimitsFromConfigDefaults(t *testing.T) {
	limits := LimitsFromConfig(config.Config{
		RateLimitEnabled:              true,
		RateLimitReadsPerMin:          120,
		RateLimitMutationsPerMin:      30,
		RateLimitInteractionsPerMin:   60,
		RateLimitSearchPerMin:         30,
		RateLimitAIPerMin:             10,
		RateLimitWindowSeconds:        60,
		RateLimitDegradedMultiplier:   2,
		RateLimitAIDegradedMultiplier: 1,
		RateLimitAIConcurrency:        5,
		RateLimitRedisTimeoutMs:       150,
		RateLimitMemoryMaxEntries:     10000,
	})

	assert.Equal(t, 120, PolicyReads.base(limits))
	assert.Equal(t, 30, PolicyMutations.base(limits))
	assert.Equal(t, 60, PolicyInteractions.base(limits))
	assert.Equal(t, 30, PolicySearch.base(limits))
	assert.Equal(t, 10, PolicyAI.base(limits))

	assert.Equal(t, 240, PolicyReads.degraded(limits), "ordinary policies get headroom")
	assert.Equal(t, 10, PolicyAI.degraded(limits), "AI keeps its quota in fallback")
	assert.True(t, PolicyAI.isAI())
	assert.False(t, PolicyReads.isAI())
}

func TestSubjectPrefersUserID(t *testing.T) {
	ctx := middleware.WithUserID(context.Background(), "u_1")
	req := httptest.NewRequest(http.MethodPost, "/query", nil)
	req = req.WithContext(ctx)

	var subject string
	Middleware(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		subject = SubjectFromContext(r.Context())
	})).ServeHTTP(httptest.NewRecorder(), req)

	assert.Equal(t, "u:u_1", subject)
}

func TestSubjectFallsBackToIP(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/query", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.7, 70.0.0.1")
	req.RemoteAddr = "10.0.0.1:4002"

	var subject, ip string
	Middleware(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		subject = SubjectFromContext(r.Context())
		ip, _ = ClientIPFromContext(r.Context())
	})).ServeHTTP(httptest.NewRecorder(), req)

	assert.Equal(t, "203.0.113.7", ip, "first forwarded entry wins")
	assert.Equal(t, "ip:203.0.113.7", subject)
}

func TestClientIPFromRequest(t *testing.T) {
	newReq := func() *http.Request {
		r := httptest.NewRequest(http.MethodPost, "/query", nil)
		r.RemoteAddr = "10.0.0.9:4002"
		return r
	}

	r := newReq()
	r.Header.Set("X-Real-IP", "198.51.100.9")
	assert.Equal(t, "198.51.100.9", ClientIPFromRequest(r))

	r = newReq()
	assert.Equal(t, "10.0.0.9", ClientIPFromRequest(r))

	r = newReq()
	r.Header.Set("X-Forwarded-For", "not-an-ip")
	assert.Equal(t, "10.0.0.9", ClientIPFromRequest(r), "spoofed values fall back to the connection address")

	r = newReq()
	r.RemoteAddr = "garbage"
	assert.Equal(t, "unknown", ClientIPFromRequest(r))
	assert.Equal(t, "unknown", ClientIPFromRequest(nil))
}

func TestSetRetryAfterHeader(t *testing.T) {
	var got string
	Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		SetRetryAfter(r.Context(), 1500)
		w.WriteHeader(http.StatusOK)
		got = w.Header().Get("Retry-After")
	})).ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/query", nil))

	assert.Equal(t, "2", got, "milliseconds round up to whole seconds")
}

func TestMiddlewarePreservesHandler(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	rec := httptest.NewRecorder()
	Middleware(next).ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/query", nil))
	assert.Equal(t, http.StatusTeapot, rec.Code)
}

func TestDegradedStartsOpenWithoutClient(t *testing.T) {
	l := New(testLimits(), nil)
	// Memory-only starts usable but degraded: Redis is authoritative,
	// so no client means fallback mode from the first request.
	d := l.Allow(context.Background(), PolicyReads, "u:a")
	require.True(t, d.Allowed)
	assert.True(t, d.Degraded)
	_ = time.Second
}
