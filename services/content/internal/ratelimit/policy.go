package ratelimit

import (
	"time"

	"github.com/kunalPisolkar24/topos/services/content/internal/config"
)

// Policy names one rate limit bucket. Each GraphQL operation maps to
// exactly one policy so quotas stay independent: a search burst never
// eats the AI generation budget.
type Policy string

const (
	// PolicyReads covers cheap unauthenticated-friendly reads.
	PolicyReads Policy = "reads"
	// PolicyMutations covers normal authenticated writes.
	PolicyMutations Policy = "mutations"
	// PolicyInteractions covers view/like/save toggles.
	PolicyInteractions Policy = "interactions"
	// PolicySearch covers AI-backed search and recommendations.
	PolicySearch Policy = "search"
	// PolicyAI covers expensive synchronous AI calls.
	PolicyAI Policy = "ai_expensive"
)

// Limits holds the resolved per-policy quotas and fallback tuning.
type Limits struct {
	Enabled              bool
	Reads                int
	Mutations            int
	Interactions         int
	Search               int
	AI                   int
	Window               time.Duration
	DegradedMultiplier   int
	AIDegradedMultiplier int
	AIConcurrency        int
	RedisTimeout         time.Duration
	MemoryMaxEntries     int
}

// LimitsFromConfig resolves the limiter tuning from service config.
func LimitsFromConfig(cfg config.Config) Limits {
	window := time.Duration(cfg.RateLimitWindowSeconds) * time.Second
	if window <= 0 {
		window = time.Minute
	}
	timeout := time.Duration(cfg.RateLimitRedisTimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 150 * time.Millisecond
	}
	return Limits{
		Enabled:              cfg.RateLimitEnabled,
		Reads:                cfg.RateLimitReadsPerMin,
		Mutations:            cfg.RateLimitMutationsPerMin,
		Interactions:         cfg.RateLimitInteractionsPerMin,
		Search:               cfg.RateLimitSearchPerMin,
		AI:                   cfg.RateLimitAIPerMin,
		Window:               window,
		DegradedMultiplier:   cfg.RateLimitDegradedMultiplier,
		AIDegradedMultiplier: cfg.RateLimitAIDegradedMultiplier,
		AIConcurrency:        cfg.RateLimitAIConcurrency,
		RedisTimeout:         timeout,
		MemoryMaxEntries:     cfg.RateLimitMemoryMaxEntries,
	}
}

// base returns the Redis-authoritative per-window quota for a policy.
func (p Policy) base(l Limits) int {
	switch p {
	case PolicyMutations:
		return l.Mutations
	case PolicyInteractions:
		return l.Interactions
	case PolicySearch:
		return l.Search
	case PolicyAI:
		return l.AI
	default:
		return l.Reads
	}
}

// degraded returns the memory-fallback quota: modest headroom for
// ordinary traffic, same-or-lower for AI so an outage cannot produce
// unbounded LLM cost.
func (p Policy) degraded(l Limits) int {
	base := p.base(l)
	if p == PolicyAI {
		mult := l.AIDegradedMultiplier
		if mult < 1 {
			mult = 1
		}
		return base * mult
	}
	mult := l.DegradedMultiplier
	if mult < 1 {
		mult = 1
	}
	return base * mult
}

// isAI reports whether the policy guards expensive AI work.
func (p Policy) isAI() bool { return p == PolicyAI }
