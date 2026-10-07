package ratelimit

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/kunalPisolkar24/topos/services/content/internal/metrics"
	"github.com/kunalPisolkar24/topos/services/content/internal/middleware"
	"github.com/redis/go-redis/v9"
)

// allowScript is an atomic fixed-window counter: INCR the bucket, arm
// its TTL on first hit, and report the count with the remaining TTL.
// Atomicity is what keeps limits correct across replicas.
const allowScript = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
local ttl = redis.call("PTTL", KEYS[1])
return {current, ttl}
`

// evaler is the Redis surface the limiter needs. *redis.Client
// satisfies it; tests stub it.
type evaler interface {
	Eval(ctx context.Context, script string, keys []string, args ...any) *redis.Cmd
}

// Decision is one quota verdict.
type Decision struct {
	Allowed    bool
	RetryAfter time.Duration
	Degraded   bool
}

// Limiter enforces per-policy quotas against the shared Redis
// instance, with a bounded process-local fallback while Redis is
// unreachable. Redis stays authoritative; memory only damps bursts to
// preserve availability. The zero value is not usable; use New.
type Limiter struct {
	client evaler
	limits Limits

	breaker *limiterBreaker

	mu     sync.Mutex
	memory map[string]*memWindow

	aiSem chan struct{}
}

type memWindow struct {
	count   int
	expires time.Time
}

// New builds a limiter sharing one Redis client (the cache's pool).
// A nil client starts degraded and serves from memory until a client
// is provided via SetClient.
func New(limits Limits, client evaler) *Limiter {
	if limits.Window <= 0 {
		limits.Window = time.Minute
	}
	if limits.RedisTimeout <= 0 {
		limits.RedisTimeout = 150 * time.Millisecond
	}
	if limits.MemoryMaxEntries <= 0 {
		limits.MemoryMaxEntries = 10000
	}
	if limits.AIConcurrency <= 0 {
		limits.AIConcurrency = 5
	}
	l := &Limiter{
		client:  client,
		limits:  limits,
		breaker: newLimiterBreaker(),
		memory:  make(map[string]*memWindow),
		aiSem:   make(chan struct{}, limits.AIConcurrency),
	}
	if client == nil {
		l.breaker.forceOpen()
	}
	return l
}

// SetClient swaps the Redis client, e.g. after reconnect. A nil client
// forces memory fallback; a fresh client closes the breaker so the
// next request probes Redis again.
func (l *Limiter) SetClient(client evaler) {
	if l == nil {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	l.client = client
	if client == nil {
		l.breaker.forceOpen()
	} else {
		l.breaker.reset()
	}
}

// Degraded reports whether the limiter currently serves from memory.
func (l *Limiter) Degraded() bool {
	if l == nil {
		return true
	}
	if !l.limits.Enabled {
		return false
	}
	return l.breaker.getState() != breakerClosed
}

// Key namespaces one bucket separately from cache keys. Subjects are
// u:<userID> or ip:<ip>; the caller must not put raw secrets in them.
func Key(policy Policy, subject string) string {
	subject = strings.TrimSpace(subject)
	if subject == "" {
		subject = "ip:unknown"
	}
	if len(subject) > 128 {
		subject = subject[:128]
	}
	return fmt.Sprintf("rl:content:%s:%s", string(policy), subject)
}

// SubjectFromContext keys by authenticated user id, falling back to
// the client IP for unauthenticated requests.
func SubjectFromContext(ctx context.Context) string {
	if userID, ok := middleware.UserIDFromContext(ctx); ok {
		return "u:" + userID
	}
	if ip, ok := ClientIPFromContext(ctx); ok {
		return "ip:" + ip
	}
	return "ip:unknown"
}

// Allow checks one quota unit against the policy. Expensive AI calls
// must use GuardAI instead so the concurrency cap applies.
func (l *Limiter) Allow(ctx context.Context, policy Policy, subject string) Decision {
	if l == nil || !l.limits.Enabled {
		return Decision{Allowed: true}
	}
	limit := policy.base(l.limits)
	if limit <= 0 {
		return Decision{Allowed: true}
	}

	if l.breaker.canProceed() && l.redisUp() {
		if d, ok := l.allowRedis(ctx, policy, subject, limit); ok {
			return d
		}
	}
	return l.allowMemory(policy, subject)
}

// GuardAI checks the AI quota and holds one concurrency slot for the
// duration of the AI call. The caller must invoke release exactly once
// (defer it) when the decision is allowed; on rejection release is nil.
func (l *Limiter) GuardAI(ctx context.Context, subject string) (Decision, func()) {
	if l == nil || !l.limits.Enabled {
		return Decision{Allowed: true}, func() {}
	}
	select {
	case l.aiSem <- struct{}{}:
		metrics.RatelimitAIInFlight.Inc()
	default:
		retry := time.Second
		l.record(PolicyAI, false, l.Degraded())
		slog.Info("ratelimit: ai concurrency exhausted", "policy", string(PolicyAI), "degraded", l.Degraded())
		return Decision{Allowed: false, RetryAfter: retry, Degraded: l.Degraded()}, nil
	}
	release := func() {
		select {
		case <-l.aiSem:
			metrics.RatelimitAIInFlight.Dec()
		default:
		}
	}
	d := l.Allow(ctx, PolicyAI, subject)
	if !d.Allowed {
		release()
		return d, nil
	}
	return d, release
}

func (l *Limiter) redisUp() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.client != nil
}

func (l *Limiter) allowRedis(ctx context.Context, policy Policy, subject string, limit int) (Decision, bool) {
	l.mu.Lock()
	client := l.client
	l.mu.Unlock()
	if client == nil {
		return Decision{}, false
	}

	timeout := l.limits.RedisTimeout
	callCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	windowMs := int64(l.limits.Window / time.Millisecond)
	res, err := client.Eval(callCtx, allowScript, []string{Key(policy, subject)}, limit, windowMs).Result()
	if err != nil {
		l.breaker.recordFailure()
		slog.Warn("ratelimit: redis failed, using memory fallback", "policy", string(policy), "error", err)
		return Decision{}, false
	}
	l.breaker.recordSuccess()

	count, ttlMs := parseEvalResult(res)
	allowed := count <= int64(limit)
	var retry time.Duration
	if !allowed {
		retry = time.Duration(ttlMs) * time.Millisecond
		if retry < 0 {
			retry = l.limits.Window
		}
		slog.Info("ratelimit: rejected", "policy", string(policy), "degraded", false)
	}
	l.record(policy, allowed, false)
	return Decision{Allowed: allowed, RetryAfter: retry}, true
}

func parseEvalResult(res any) (count, ttlMs int64) {
	vals, ok := res.([]any)
	if !ok || len(vals) != 2 {
		return 0, 0
	}
	count, _ = toInt64(vals[0])
	ttlMs, _ = toInt64(vals[1])
	return count, ttlMs
}

func toInt64(v any) (int64, bool) {
	switch n := v.(type) {
	case int64:
		return n, true
	case int:
		return int64(n), true
	case int32:
		return int64(n), true
	default:
		return 0, false
	}
}

func (l *Limiter) allowMemory(policy Policy, subject string) Decision {
	limit := policy.degraded(l.limits)
	if limit <= 0 {
		limit = 1
	}
	key := Key(policy, subject)
	now := time.Now()

	l.mu.Lock()
	w, ok := l.memory[key]
	if !ok || now.After(w.expires) {
		if !ok && len(l.memory) >= l.limits.MemoryMaxEntries {
			l.evictExpiredLocked(now)
			if len(l.memory) >= l.limits.MemoryMaxEntries {
				l.mu.Unlock()
				l.record(policy, true, true)
				return Decision{Allowed: true, Degraded: true}
			}
		}
		w = &memWindow{expires: now.Add(l.limits.Window)}
		l.memory[key] = w
	}
	w.count++
	count := w.count
	retry := time.Until(w.expires)
	l.mu.Unlock()

	allowed := count <= limit
	if !allowed {
		slog.Info("ratelimit: rejected", "policy", string(policy), "degraded", true)
	}
	l.record(policy, allowed, true)
	return Decision{Allowed: allowed, RetryAfter: retry, Degraded: true}
}

func (l *Limiter) evictExpiredLocked(now time.Time) {
	for k, w := range l.memory {
		if now.After(w.expires) {
			delete(l.memory, k)
		}
	}
}

func (l *Limiter) record(policy Policy, allowed, degraded bool) {
	decision := "allowed"
	if !allowed {
		decision = "rejected"
	}
	mode := "redis"
	if degraded {
		mode = "memory"
	}
	metrics.RatelimitDecisionsTotal.WithLabelValues(string(policy), decision, mode).Inc()
}

// limiterBreaker trips after consecutive Redis failures and probes
// again after the reset window. Unlike the cache breaker it carries no
// background goroutine: recovery is driven by the next request, which
// keeps it safe for short-lived processes too.
type limiterBreaker struct {
	mu              sync.Mutex
	state           breakerState
	failures        int
	lastFailureTime time.Time
}

type breakerState int

const (
	breakerClosed breakerState = iota
	breakerOpen
	breakerHalfOpen
)

const (
	limiterFailureThreshold = 3
	limiterResetWindow      = 10 * time.Second
)

func newLimiterBreaker() *limiterBreaker {
	b := &limiterBreaker{state: breakerClosed}
	metrics.RatelimitBreakerState.Set(float64(breakerClosed))
	return b
}

func (b *limiterBreaker) getState() breakerState {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.state
}

func (b *limiterBreaker) canProceed() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.state == breakerOpen && time.Since(b.lastFailureTime) > limiterResetWindow {
		b.state = breakerHalfOpen
		metrics.RatelimitBreakerState.Set(float64(breakerHalfOpen))
	}
	return b.state != breakerOpen
}

func (b *limiterBreaker) recordSuccess() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.state != breakerClosed {
		b.state = breakerClosed
		metrics.RatelimitBreakerState.Set(float64(breakerClosed))
	}
	b.failures = 0
}

func (b *limiterBreaker) recordFailure() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.failures++
	b.lastFailureTime = time.Now()
	if b.state == breakerHalfOpen || (b.state == breakerClosed && b.failures >= limiterFailureThreshold) {
		b.state = breakerOpen
		metrics.RatelimitBreakerState.Set(float64(breakerOpen))
	}
}

func (b *limiterBreaker) forceOpen() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.failures = limiterFailureThreshold
	b.lastFailureTime = time.Now()
	b.state = breakerOpen
	metrics.RatelimitBreakerState.Set(float64(breakerOpen))
}

func (b *limiterBreaker) reset() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.failures = 0
	b.state = breakerClosed
	metrics.RatelimitBreakerState.Set(float64(breakerClosed))
}
