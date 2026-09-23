package cache

import (
	"context"
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/kunalPisolkar24/topos/services/content/internal/metrics"
	"github.com/redis/go-redis/v9"
)

const (
	PostsTTL   = time.Minute
	PostTTL    = 5 * time.Minute
	TagsTTL    = 5 * time.Minute
	SearchTTL  = 2 * time.Minute
	RelatedTTL = 2 * time.Minute
	// RecommendTTL is short because a user's interest profile changes
	// as they interact; the content service has no invalidation signal
	// for it, so freshness is bounded by the TTL.
	RecommendTTL = 30 * time.Second
	SeenViewTTL  = 24 * time.Hour

	PostsPattern     = "posts:*"
	TagsPattern      = "tags:*"
	SearchPattern    = "search:*"
	RelatedPattern   = "related:*"
	RecommendPattern = "recommend:*"

	// dialTimeout bounds the initial connection handshake.
	dialTimeout = 2 * time.Second
	// commandTimeout bounds a single command round trip; together with
	// MaxRetries it bounds the total time a call can block the request.
	commandTimeout = 3 * time.Second
	// retries and backoff are stated explicitly so behavior does not
	// silently depend on go-redis defaults.
	maxRetries      = 3
	minRetryBackoff = 50 * time.Millisecond
	maxRetryBackoff = 500 * time.Millisecond

	cacheFailureThreshold = 3
	cacheSuccessThreshold = 1
	cacheResetWindow      = 10 * time.Second
)

// Cache is a thin, best-effort Redis cache. Every call swallows errors so
// the cache can never break the service, but Redis failures are logged at
// warn level and counted in content_cache_errors_total so degradation is
// observable instead of invisible. A circuit breaker prevents a dead Redis
// from adding seconds of timeout to every request.
type Cache struct {
	client *redis.Client
	opts   Options
	breaker *cacheBreaker

	// coalesceMu guards inFlight, the single-flight registry that
	// merges concurrent fills of the same key into one.
	coalesceMu sync.Mutex
	inFlight   map[string]*inFlightCall

	stopCh chan struct{}
	once   sync.Once
}

// inFlightCall is a shared fill in progress; waiters block on done and
// read the fill result once it is closed.
type inFlightCall struct {
	done   chan struct{}
	result any
	err    error
}

// Options configures the redis connection for a single standalone node.
type Options struct {
	Addr     string // redis address, e.g. "localhost:6379"
	Password string // optional auth password
}

// New dials redis and returns a ready cache. It fails fast so the caller
// can decide whether to disable caching.
func New(ctx context.Context, opts Options) (*Cache, error) {
	client := newClient(opts)

	pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx).Err(); err != nil {
		_ = client.Close()
		return nil, err
	}

	c := &Cache{
		client:  client,
		opts:    opts,
		breaker: newCacheBreaker(),
		inFlight: make(map[string]*inFlightCall),
		stopCh:  make(chan struct{}),
	}
	c.breaker.recordSuccess()
	go c.reconnectLoop()
	return c, nil
}

// NewResilient dials redis and returns a cache that degrades gracefully
// and recovers automatically. Unlike New it never returns an error: when
// redis is unavailable at startup it returns a degraded cache whose
// breaker is open and which probes in the background, so callers do not
// need to handle a nil cache and the service recovers without a restart.
func NewResilient(ctx context.Context, opts Options) *Cache {
	client := newClient(opts)
	c := &Cache{
		client:  client,
		opts:    opts,
		breaker: newCacheBreaker(),
		inFlight: make(map[string]*inFlightCall),
		stopCh:  make(chan struct{}),
	}

	pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx).Err(); err != nil {
		c.breaker.forceOpen()
	} else {
		c.breaker.recordSuccess()
	}
	go c.reconnectLoop()
	return c
}

func newClient(opts Options) *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr:            opts.Addr,
		Password:        opts.Password,
		DialTimeout:     dialTimeout,
		ReadTimeout:     commandTimeout,
		WriteTimeout:    commandTimeout,
		MaxRetries:      maxRetries,
		MinRetryBackoff: minRetryBackoff,
		MaxRetryBackoff: maxRetryBackoff,
	})
}

func (c *Cache) Close() error {
	if c == nil {
		return nil
	}
	c.once.Do(func() { close(c.stopCh) })
	if c.client != nil {
		return c.client.Close()
	}
	return nil
}

// Degraded reports whether the cache is currently in a degraded state
// (breaker open or half-open). It is used for logging at startup.
func (c *Cache) Degraded() bool {
	if c == nil {
		return true
	}
	return c.breaker.getState() != stateClosed
}

// Healthy reports whether the cache can serve requests (breaker closed and
// a recent ping succeeded).
func (c *Cache) Healthy() bool {
	if c == nil {
		return false
	}
	if c.breaker.getState() != stateClosed {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	return c.client.Ping(ctx).Err() == nil
}

func (c *Cache) reconnectLoop() {
	ticker := time.NewTicker(cacheResetWindow)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if c.breaker.getState() != stateOpen {
				continue
			}
			if !c.breaker.canProceed() {
				continue
			}
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			err := c.client.Ping(ctx).Err()
			cancel()
			if err == nil {
				c.breaker.recordSuccess()
			} else {
				c.breaker.recordFailure()
			}
		case <-c.stopCh:
			return
		}
	}
}

// Get returns the cached value for key, if present and decodable. A
// missing key is a normal miss and stays silent; any other Redis error
// is logged at warn level and counted as a cache error so degradation
// is observable. When the breaker is open the call fails fast as a miss.
func Get[T any](c *Cache, ctx context.Context, key string) (*T, bool) {
	if c == nil {
		return nil, false
	}
	if !c.breaker.canProceed() {
		return nil, false
	}

	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			c.breaker.recordSuccess()
			return nil, false
		}
		c.breaker.recordFailure()
		cacheError("get", "key", key, err)
		return nil, false
	}

	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		slog.Debug("cache: unmarshal failed", "key", key, "error", err)
		c.breaker.recordSuccess()
		return nil, false
	}
	c.breaker.recordSuccess()
	return &value, true
}

// Set stores value under key with the given ttl.
func Set(c *Cache, ctx context.Context, key string, value any, ttl time.Duration) {
	if c == nil {
		return
	}
	if !c.breaker.canProceed() {
		return
	}

	data, err := json.Marshal(value)
	if err != nil {
		slog.Debug("cache: marshal failed", "key", key, "error", err)
		return
	}

	if err := c.client.Set(ctx, key, data, ttl).Err(); err != nil {
		c.breaker.recordFailure()
		cacheError("set", "key", key, err)
		return
	}
	c.breaker.recordSuccess()
}

// Del removes a single key.
func Del(c *Cache, ctx context.Context, key string) {
	if c == nil {
		return
	}
	if !c.breaker.canProceed() {
		return
	}
	if err := c.client.Del(ctx, key).Err(); err != nil {
		c.breaker.recordFailure()
		cacheError("del", "key", key, err)
		return
	}
	c.breaker.recordSuccess()
}

// MarkSeen atomically marks key as seen: it returns true when the key
// was newly set (the caller is the first to see it) and false when the
// key already exists. Redis failures fail open - the key is treated as
// unseen so a dedupe outage degrades to publishing duplicates instead
// of dropping signals. When the breaker is open it fails open instantly.
func MarkSeen(c *Cache, ctx context.Context, key string, ttl time.Duration) bool {
	if c == nil {
		return true
	}
	if !c.breaker.canProceed() {
		return true
	}

	ok, err := c.client.SetNX(ctx, key, "1", ttl).Result()
	if err != nil {
		c.breaker.recordFailure()
		cacheError("setnx", "key", key, err)
		return true
	}
	c.breaker.recordSuccess()
	return ok
}

// DelPattern removes every key matching the glob pattern.
func DelPattern(c *Cache, ctx context.Context, pattern string) {
	if c == nil {
		return
	}
	if !c.breaker.canProceed() {
		return
	}

	var keys []string
	iter := c.client.Scan(ctx, 0, pattern, 0).Iterator()
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	if err := iter.Err(); err != nil {
		c.breaker.recordFailure()
		cacheError("scan", "pattern", pattern, err)
		return
	}
	if len(keys) == 0 {
		c.breaker.recordSuccess()
		return
	}

	if err := c.client.Del(ctx, keys...).Err(); err != nil {
		c.breaker.recordFailure()
		cacheError("del", "pattern", pattern, err)
		return
	}
	c.breaker.recordSuccess()
}

// cacheError logs a Redis failure at warn level and counts it, so a
// dying Redis shows up in logs and metrics instead of only as a debug
// line. The cache still degrades gracefully: the caller falls through
// to the database.
func cacheError(op string, keyAttr string, keyValue string, err error) {
	slog.Warn("cache: operation failed", "op", op, keyAttr, keyValue, "error", err)
	metrics.CacheErrorsTotal.Inc()
}

// coalesce runs fill once for key; concurrent callers for the same key
// wait on the shared call instead of each executing the underlying
// operation (cache stampede). The in-flight entry is removed when the
// fill completes, so a later request starts a fresh fill; failed fills
// are not shared beyond the flight.
func (c *Cache) coalesce(key string, fill func() (any, error)) (any, error) {
	if c == nil {
		return fill()
	}

	c.coalesceMu.Lock()
	if c.inFlight == nil {
		c.inFlight = make(map[string]*inFlightCall)
	}
	if call, ok := c.inFlight[key]; ok {
		c.coalesceMu.Unlock()
		<-call.done
		return call.result, call.err
	}

	call := &inFlightCall{done: make(chan struct{})}
	c.inFlight[key] = call
	c.coalesceMu.Unlock()

	call.result, call.err = fill()
	close(call.done)

	c.coalesceMu.Lock()
	delete(c.inFlight, key)
	c.coalesceMu.Unlock()

	return call.result, call.err
}

// Coalesce is the generic entry point for single-flight fills: only the
// first caller executes fill, the rest share its result or error.
func Coalesce[T any](c *Cache, key string, fill func() (T, error)) (T, error) {
	got, err := c.coalesce(key, func() (any, error) { return fill() })
	if err != nil {
		var zero T
		return zero, err
	}
	return got.(T), nil
}

func KeyPost(id string) string {
	return "post:" + id
}

func KeyPosts(page, limit int) string {
	return fmt.Sprintf("posts:page:%d:limit:%d", page, limit)
}

func KeyPostsByAuthor(authorID string, page, limit int) string {
	return fmt.Sprintf("posts:author:%s:page:%d:limit:%d", authorID, page, limit)
}

func KeyPostsByTag(tag string, page, limit int) string {
	return fmt.Sprintf("posts:tag:%s:page:%d:limit:%d", tag, page, limit)
}

func KeyTags(query string, limit int) string {
	return fmt.Sprintf("tags:q:%s:limit:%d", query, limit)
}

func KeySearch(query string, page, limit int) string {
	sum := sha1.Sum([]byte(query))
	return fmt.Sprintf("search:q:%x:p:%d:l:%d", sum, page, limit)
}

func KeyRelated(postID string, limit int) string {
	return fmt.Sprintf("related:%s:l:%d", postID, limit)
}

func KeyRecommended(userID string, mode string, seed uint32, page, limit int) string {
	return fmt.Sprintf("recommend:u:%s:m:%s:s:%d:p:%d:l:%d", userID, mode, seed, page, limit)
}

func KeySeenView(userID, postID string) string {
	return fmt.Sprintf("seen:%s:%s", userID, postID)
}

// circuitState models the breaker lifecycle.
type circuitState int

const (
	stateClosed circuitState = iota
	stateOpen
	stateHalfOpen
)

type cacheBreaker struct {
	mu              sync.Mutex
	state           circuitState
	failureCount    int
	successCount    int
	inFlight        int
	lastFailureTime time.Time
}

func newCacheBreaker() *cacheBreaker {
	b := &cacheBreaker{state: stateClosed}
	metrics.CacheBreakerState.Set(float64(stateClosed))
	return b
}

func (b *cacheBreaker) getState() circuitState {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.state
}

func (b *cacheBreaker) setState(s circuitState) {
	b.state = s
	metrics.CacheBreakerState.Set(float64(s))
}

func (b *cacheBreaker) canProceed() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	switch b.state {
	case stateOpen:
		if time.Since(b.lastFailureTime) > cacheResetWindow {
			b.setState(stateHalfOpen)
			b.successCount = 0
			b.inFlight = 1
			return true
		}
		return false
	case stateHalfOpen:
		if b.inFlight > 0 {
			return false
		}
		b.inFlight = 1
		return true
	default:
		return true
	}
}

func (b *cacheBreaker) recordSuccess() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.inFlight = 0
	switch b.state {
	case stateHalfOpen:
		b.successCount++
		if b.successCount >= cacheSuccessThreshold {
			b.setState(stateClosed)
			b.failureCount = 0
		}
	case stateClosed:
		b.failureCount = 0
	}
}

func (b *cacheBreaker) recordFailure() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.inFlight = 0
	b.failureCount++
	b.lastFailureTime = time.Now()
	switch b.state {
	case stateClosed:
		if b.failureCount >= cacheFailureThreshold {
			b.setState(stateOpen)
		}
	case stateHalfOpen:
		b.setState(stateOpen)
	}
}

func (b *cacheBreaker) forceOpen() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.failureCount = cacheFailureThreshold
	b.lastFailureTime = time.Now()
	b.setState(stateOpen)
	b.inFlight = 0
	b.successCount = 0
}
