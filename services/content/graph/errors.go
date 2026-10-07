package graph

import (
	"context"
	"errors"
	"log/slog"

	"github.com/99designs/gqlgen/graphql"
	"github.com/kunalPisolkar24/topos/services/content/internal/domain"
	"github.com/kunalPisolkar24/topos/services/content/internal/metrics"
	"github.com/kunalPisolkar24/topos/services/content/internal/middleware"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

// errorKindExtension marks gqlerror.Errors produced by mapDomainError so
// the error presenter can classify them without string matching.
const errorKindExtension = "kind"

// rateLimitExtensions are the machine-readable fields a rate-limited
// response carries. kind stays rate_limited for metrics; code is the
// stable wire contract clients branch on.
const (
	rateLimitCodeExtension       = "code"
	rateLimitRetryAfterExtension = "retryAfterMs"
	rateLimitPolicyExtension     = "policy"
	rateLimitCodeValue           = "RATE_LIMITED"
)

// mapDomainError converts a service error into a client-safe GraphQL
// error. Unexpected errors keep a generic message and the original error
// is preserved (wrapped) so the presenter can log it.
func mapDomainError(err error) *gqlerror.Error {
	var gqlErr *gqlerror.Error
	if errors.As(err, &gqlErr) {
		return gqlErr
	}

	kind, message := "internal", "internal error"
	extensions := map[string]any{errorKindExtension: kind}
	switch {
	case errors.Is(err, domain.ErrUnauthorized):
		kind, message = "unauthorized", "unauthorized"
	case errors.Is(err, domain.ErrForbidden):
		kind, message = "forbidden", "forbidden"
	case errors.Is(err, domain.ErrNotFound):
		kind, message = "not_found", "not found"
	case errors.Is(err, domain.ErrValidation):
		kind, message = "validation", err.Error()
	case errors.Is(err, domain.ErrConflict):
		kind, message = "conflict", "already reviewed by someone else"
	case errors.Is(err, domain.ErrAIUnavailable):
		kind, message = "unavailable", "AI service is temporarily unavailable, please try again"
	case errors.Is(err, domain.ErrRateLimited):
		kind = "rate_limited"
		var rlErr *domain.RateLimitError
		retryMs := int64(1000)
		policy := ""
		if errors.As(err, &rlErr) && rlErr != nil {
			retryMs = rlErr.RetryAfter.Milliseconds()
			if retryMs < 1 {
				retryMs = 1
			}
			policy = rlErr.Policy
			message = rlErr.Error()
		} else {
			message = "rate limited, retry after 1s"
		}
		extensions = map[string]any{
			errorKindExtension:           kind,
			rateLimitCodeExtension:       rateLimitCodeValue,
			rateLimitRetryAfterExtension: retryMs,
			rateLimitPolicyExtension:     policy,
		}
		return &gqlerror.Error{Message: message, Extensions: extensions}
	}
	extensions[errorKindExtension] = kind

	return &gqlerror.Error{
		Message:    message,
		Extensions: extensions,
	}
}

// PresentError is the gqlgen error presenter. Safe messages are passed
// through; anything unexpected is never leaked to the client - it is
// logged with the request id and returned as a generic "internal error".
// Every error is counted by operation and kind.
func PresentError(ctx context.Context, err error) *gqlerror.Error {
	var gqlErr *gqlerror.Error
	kind := "internal"
	if errors.As(err, &gqlErr) {
		if k, ok := gqlErr.Extensions[errorKindExtension].(string); ok && k != "" {
			kind = k
		} else if len(gqlErr.Path) > 0 || len(gqlErr.Locations) > 0 {
			// Query validation and protocol errors are client-safe.
			kind = "client"
		}
	}

	message := "internal error"
	if kind != "internal" {
		if gqlErr != nil {
			message = gqlErr.Message
		} else {
			message = err.Error()
		}
	} else {
		slog.Error("graphql operation failed",
			"error", err,
			"request_id", requestIDFromContext(ctx),
			"operation", operationName(ctx),
		)
	}

	metrics.GraphQLErrorsTotal.WithLabelValues(operationName(ctx), kind).Inc()

	out := &gqlerror.Error{Message: message}
	if gqlErr != nil {
		out.Path = gqlErr.Path
	}
	extensions := map[string]any{}
	if rid, ok := middleware.RequestIDFromContext(ctx); ok {
		extensions["request_id"] = rid
	}
	if gqlErr != nil && gqlErr.Extensions != nil {
		if code, ok := gqlErr.Extensions[rateLimitCodeExtension]; ok {
			extensions[rateLimitCodeExtension] = code
		}
		if retry, ok := gqlErr.Extensions[rateLimitRetryAfterExtension]; ok {
			extensions[rateLimitRetryAfterExtension] = retry
		}
		if policy, ok := gqlErr.Extensions[rateLimitPolicyExtension]; ok {
			extensions[rateLimitPolicyExtension] = policy
		}
	}
	if len(extensions) > 0 {
		out.Extensions = extensions
	}
	return out
}

// RecoverError converts a resolver panic into a generic error. The
// panic details are logged server-side; the client only sees
// "internal error" (which the presenter classifies and counts as
// internal).
func RecoverError(ctx context.Context, recovered any) (userMessage error) {
	slog.Error("graphql resolver panic",
		"panic", recovered,
		"request_id", requestIDFromContext(ctx),
		"operation", operationName(ctx),
	)
	metrics.GraphQLErrorsTotal.WithLabelValues(operationName(ctx), "internal").Inc()
	return errors.New("internal error")
}

func operationName(ctx context.Context) string {
	if !graphql.HasOperationContext(ctx) {
		return "anonymous"
	}
	if opCtx := graphql.GetOperationContext(ctx); opCtx != nil && opCtx.OperationName != "" {
		return opCtx.OperationName
	}
	return "anonymous"
}

func requestIDFromContext(ctx context.Context) string {
	rid, _ := middleware.RequestIDFromContext(ctx)
	return rid
}
