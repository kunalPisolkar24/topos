package health

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestChecker_AllOK(t *testing.T) {
	c := NewChecker(time.Second)
	c.Register("a", func(_ context.Context) error { return nil })
	c.Register("b", func(_ context.Context) error { return nil })

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	c.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var body response
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "ok", body.Status)
	assert.Len(t, body.Checks, 2)
	for _, r := range body.Checks {
		assert.True(t, r.OK)
		assert.Empty(t, r.Err)
	}
}

func TestChecker_OneFails_Returns503(t *testing.T) {
	c := NewChecker(time.Second)
	c.Register("a", func(_ context.Context) error { return nil })
	c.Register("b", func(_ context.Context) error { return errors.New("down") })

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	c.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var body response
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "unhealthy", body.Status)

	byName := map[string]result{}
	for _, r := range body.Checks {
		byName[r.Name] = r
	}
	assert.True(t, byName["a"].OK)
	assert.False(t, byName["b"].OK)
	assert.Equal(t, "down", byName["b"].Err)
}

func TestChecker_RunsChecksInParallel(t *testing.T) {
	c := NewChecker(500 * time.Millisecond)
	c.Register("slow", func(ctx context.Context) error {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(200 * time.Millisecond):
			return nil
		}
	})
	c.Register("fast", func(_ context.Context) error {
		time.Sleep(10 * time.Millisecond)
		return nil
	})

	start := time.Now()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	c.Handler().ServeHTTP(w, req)
	elapsed := time.Since(start)

	assert.Less(t, elapsed, 250*time.Millisecond, "checks should run in parallel")
}

func TestChecker_Timeout(t *testing.T) {
	c := NewChecker(50 * time.Millisecond)
	c.Register("slow", func(ctx context.Context) error {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Second):
			return nil
		}
	})

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	c.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}
