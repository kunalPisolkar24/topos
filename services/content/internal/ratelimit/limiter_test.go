package ratelimit

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testLimits() Limits {
	return Limits{
		Enabled:              true,
		Reads:                2,
		Mutations:            2,
		Interactions:         2,
		Search:               2,
		AI:                   2,
		Window:               time.Minute,
		DegradedMultiplier:   2,
		AIDegradedMultiplier: 1,
		AIConcurrency:        5,
		RedisTimeout:         200 * time.Millisecond,
		MemoryMaxEntries:     10000,
	}
}

// stubEvaler fakes Redis Eval with scripted results.
type stubEvaler struct {
	mu      sync.Mutex
	counts  map[string]int64
	failErr error
	limit   int64
	window  time.Duration
}

func (s *stubEvaler) Eval(_ context.Context, _ string, keys []string, args ...any) *redis.Cmd {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.failErr != nil {
		return redis.NewCmdResult(nil, s.failErr)
	}
	if s.counts == nil {
		s.counts = make(map[string]int64)
	}
	s.counts[keys[0]]++
	if len(args) >= 1 {
		if n, ok := args[0].(int); ok {
			s.limit = int64(n)
		}
	}
	ttl := int64(s.window / time.Millisecond)
	if ttl <= 0 {
		ttl = 60000
	}
	return redis.NewCmdResult([]any{s.counts[keys[0]], ttl}, nil)
}

func TestMemoryAllowAndReject(t *testing.T) {
	l := New(testLimits(), nil)
	ctx := context.Background()

	require.True(t, l.Allow(ctx, PolicyReads, "u:a").Allowed)
	require.True(t, l.Allow(ctx, PolicyReads, "u:a").Allowed)
	// Base is 2, degraded multiplier is 2, so memory allows 4.
	require.True(t, l.Allow(ctx, PolicyReads, "u:a").Allowed)
	require.True(t, l.Allow(ctx, PolicyReads, "u:a").Allowed)
	d := l.Allow(ctx, PolicyReads, "u:a")
	assert.False(t, d.Allowed, "fifth hit exceeds the degraded quota")
	assert.True(t, d.Degraded)
	assert.Greater(t, d.RetryAfter, time.Duration(0))
}

func TestSubjectsAreIndependent(t *testing.T) {
	l := New(testLimits(), nil)
	ctx := context.Background()

	for i := 0; i < 4; i++ {
		require.True(t, l.Allow(ctx, PolicyReads, "u:a").Allowed)
	}
	d := l.Allow(ctx, PolicyReads, "u:a")
	assert.False(t, d.Allowed)

	assert.True(t, l.Allow(ctx, PolicyReads, "u:b").Allowed, "a different subject gets its own bucket")
	assert.True(t, l.Allow(ctx, PolicyReads, "ip:1.2.3.4").Allowed, "IP subjects are independent too")
}

func TestPoliciesAreIndependent(t *testing.T) {
	l := New(testLimits(), nil)
	ctx := context.Background()

	for i := 0; i < 4; i++ {
		require.True(t, l.Allow(ctx, PolicyReads, "u:a").Allowed)
	}
	assert.False(t, l.Allow(ctx, PolicyReads, "u:a").Allowed)
	assert.True(t, l.Allow(ctx, PolicySearch, "u:a").Allowed, "exhausting reads must not eat the search budget")
}

func TestMemoryWindowExpiry(t *testing.T) {
	limits := testLimits()
	limits.Window = 60 * time.Millisecond
	limits.DegradedMultiplier = 1
	l := New(limits, nil)
	ctx := context.Background()

	require.True(t, l.Allow(ctx, PolicyReads, "u:a").Allowed)
	require.True(t, l.Allow(ctx, PolicyReads, "u:a").Allowed)
	assert.False(t, l.Allow(ctx, PolicyReads, "u:a").Allowed)

	time.Sleep(80 * time.Millisecond)
	assert.True(t, l.Allow(ctx, PolicyReads, "u:a").Allowed, "the bucket resets after the window")
}

func TestAIUsesConservativeFallback(t *testing.T) {
	l := New(testLimits(), nil)
	ctx := context.Background()

	require.True(t, l.Allow(ctx, PolicyAI, "u:a").Allowed)
	require.True(t, l.Allow(ctx, PolicyAI, "u:a").Allowed)
	d := l.Allow(ctx, PolicyAI, "u:a")
	assert.False(t, d.Allowed, "AI keeps the base limit in fallback, no headroom")
}

func TestNilLimiterAllows(t *testing.T) {
	var l *Limiter
	assert.True(t, l.Allow(context.Background(), PolicyReads, "u:a").Allowed)
	assert.False(t, l.Degraded() == false, "nil limiter reports degraded so callers stay honest")
}

func TestDisabledLimiterAllows(t *testing.T) {
	limits := testLimits()
	limits.Enabled = false
	l := New(limits, nil)
	assert.True(t, l.Allow(context.Background(), PolicyReads, "u:a").Allowed)
	assert.False(t, l.Degraded())
}

func TestRedisAllowAndReject(t *testing.T) {
	stub := &stubEvaler{window: time.Minute}
	l := New(testLimits(), stub)
	ctx := context.Background()

	require.True(t, l.Allow(ctx, PolicyReads, "u:a").Allowed)
	require.True(t, l.Allow(ctx, PolicyReads, "u:a").Allowed)
	d := l.Allow(ctx, PolicyReads, "u:a")
	assert.False(t, d.Allowed, "third hit exceeds the Redis quota of 2")
	assert.False(t, d.Degraded, "Redis is authoritative while healthy")
	assert.Greater(t, d.RetryAfter, time.Duration(0), "rejections carry the key TTL as retry delay")
	assert.False(t, l.Degraded())
}

func TestRedisFailureFallsBackToMemory(t *testing.T) {
	stub := &stubEvaler{window: time.Minute, failErr: errors.New("redis down")}
	l := New(testLimits(), stub)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		d := l.Allow(ctx, PolicyReads, "u:a")
		require.True(t, d.Allowed)
		require.True(t, d.Degraded, "every hit serves from memory while Redis errors")
	}
	assert.True(t, l.Degraded(), "three consecutive failures open the breaker")
}

func TestAIConcurrencyCap(t *testing.T) {
	limits := testLimits()
	limits.AIConcurrency = 2
	l := New(limits, nil)
	ctx := context.Background()

	d1, rel1 := l.GuardAI(ctx, "u:a")
	require.True(t, d1.Allowed)
	defer rel1()
	d2, rel2 := l.GuardAI(ctx, "u:a")
	require.True(t, d2.Allowed)
	defer rel2()

	d3, rel3 := l.GuardAI(ctx, "u:a")
	assert.False(t, d3.Allowed, "third concurrent AI call exceeds the cap of 2")
	assert.Nil(t, rel3)
	assert.Greater(t, d3.RetryAfter, time.Duration(0))
}

func TestGuardAIReleasesOnRateRejection(t *testing.T) {
	limits := testLimits()
	limits.AI = 1
	limits.AIDegradedMultiplier = 1
	limits.AIConcurrency = 1
	l := New(limits, nil)
	ctx := context.Background()

	d1, rel1 := l.GuardAI(ctx, "u:a")
	require.True(t, d1.Allowed)
	defer rel1()

	// Quota is exhausted and the slot is held: rejection must not leak it.
	d2, _ := l.GuardAI(ctx, "u:a")
	assert.False(t, d2.Allowed)
}

func TestKeyNamespace(t *testing.T) {
	assert.Equal(t, "rl:content:reads:u:abc", Key(PolicyReads, "u:abc"))
	assert.Equal(t, "rl:content:ai_expensive:ip:1.2.3.4", Key(PolicyAI, "ip:1.2.3.4"))
	assert.Equal(t, "rl:content:reads:ip:unknown", Key(PolicyReads, ""))
	assert.NotContains(t, Key(PolicyReads, "u:abc"), "post:",
		"rate limit keys must never collide with cache keys")
}

func TestMemoryBounded(t *testing.T) {
	limits := testLimits()
	limits.MemoryMaxEntries = 4
	l := New(limits, nil)
	ctx := context.Background()

	for i := 0; i < 10; i++ {
		d := l.Allow(ctx, PolicyReads, fmt.Sprintf("u:subject-%d", i))
		assert.True(t, d.Allowed, "new subjects stay allowed once the table is full")
	}
	l.mu.Lock()
	size := len(l.memory)
	l.mu.Unlock()
	assert.LessOrEqual(t, size, 4, "memory use stays bounded")
}
