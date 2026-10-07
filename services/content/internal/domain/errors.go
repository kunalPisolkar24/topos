package domain

import (
	"errors"
	"fmt"
	"time"
)

var (
	ErrNotFound     = errors.New("not found")
	ErrForbidden    = errors.New("forbidden")
	ErrUnauthorized = errors.New("unauthorized")
	// ErrConflict marks a state transition that lost a race: another
	// request already moved the resource to an incompatible status.
	ErrConflict = errors.New("conflict")
	// ErrValidation marks client input that failed service-layer
	// validation. The wrapped message is safe to surface to the client.
	ErrValidation = errors.New("validation error")
	// ErrAICircuitOpen is returned by the resilient AI client while a
	// circuit breaker is open. Workers treat it as a deterministic,
	// fast-failing condition and dead-letter the message immediately
	// instead of burning the retry backoff.
	ErrAICircuitOpen = errors.New("ai circuit breaker open")
	// ErrAIUnavailable marks a failed AI RPC (e.g. provider outage or
	// malformed provider response after retries). Workers treat it as
	// retryable; user-facing resolvers map it to a friendly message.
	ErrAIUnavailable = errors.New("ai service unavailable")
	// ErrRateLimited marks a rejected request that exceeded its
	// Redis-backed quota. Use NewRateLimitedError to attach the policy
	// and retry delay; errors.Is against ErrRateLimited still matches.
	ErrRateLimited = errors.New("rate limited")
)

// RateLimitError carries machine-readable retry metadata for a
// rate-limited request. Policy names the quota that tripped;
// RetryAfter tells the caller how long to wait before retrying.
type RateLimitError struct {
	Policy     string
	RetryAfter time.Duration
}

func (e *RateLimitError) Error() string {
	secs := int(e.RetryAfter.Round(time.Second).Seconds())
	if secs < 1 {
		secs = 1
	}
	return fmt.Sprintf("rate limited, retry after %ds", secs)
}

func (e *RateLimitError) Unwrap() error { return ErrRateLimited }

// NewRateLimitedError builds a RateLimitError that matches
// errors.Is(err, ErrRateLimited).
func NewRateLimitedError(policy string, retryAfter time.Duration) *RateLimitError {
	if retryAfter < 0 {
		retryAfter = 0
	}
	return &RateLimitError{Policy: policy, RetryAfter: retryAfter}
}
