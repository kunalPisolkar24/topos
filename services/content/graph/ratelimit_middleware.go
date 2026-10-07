package graph

import (
	"context"
	"strings"

	"github.com/99designs/gqlgen/graphql"
	"github.com/kunalPisolkar24/topos/services/content/internal/domain"
	"github.com/kunalPisolkar24/topos/services/content/internal/ratelimit"
)

// fieldPolicy maps a top-level GraphQL field to its rate limit bucket.
// Only Query and Mutation root fields are limited; nested fields
// (Post.related, Post.likedByMe) inherit the parent's budget because
// batching already collapses them into one AI call per request.
//
// Review approvals share the AI budget even when the draft is
// human-authored (no AI call): distinguishing would need a DB lookup
// in the hot path, so the mapping stays conservative on LLM cost.
func fieldPolicy(object, field string) (ratelimit.Policy, bool) {
	if strings.HasPrefix(field, "__") || field == "_service" {
		return "", false
	}
	switch object {
	case "Query":
		switch field {
		case "posts", "post", "tags", "postsByTag",
			"chats", "chat", "chatMessages",
			"postDrafts", "myPostDrafts",
			"_entities":
			return ratelimit.PolicyReads, true
		case "searchPosts", "recommendedPosts":
			return ratelimit.PolicySearch, true
		}
	case "Mutation":
		switch field {
		case "createPost", "updatePost", "deletePost",
			"createChat", "renameChat", "deleteChat",
			"createContentDraft", "resubmitContentDraft", "deletePostDraft":
			return ratelimit.PolicyMutations, true
		case "recordPostView", "likePost", "savePost":
			return ratelimit.PolicyInteractions, true
		case "generateTags", "generatePostContent",
			"createPostDraft", "approvePostDraft", "rejectPostDraft",
			"askChat":
			return ratelimit.PolicyAI, true
		}
	case "User":
		if field == "posts" {
			return ratelimit.PolicyReads, true
		}
	}
	return "", false
}

// FieldRateLimit returns gqlgen field middleware enforcing one quota
// unit per top-level operation before the resolver (and any downstream
// AI call) runs. A nil limiter disables checks. Rejections carry
// extensions {code: RATE_LIMITED, retryAfterMs, policy} and set the
// Retry-After response header.
func FieldRateLimit(limiter *ratelimit.Limiter) graphql.FieldMiddleware {
	return func(ctx context.Context, next graphql.Resolver) (any, error) {
		if limiter == nil {
			return next(ctx)
		}
		fc := graphql.GetFieldContext(ctx)
		if fc == nil {
			return next(ctx)
		}
		policy, ok := fieldPolicy(fc.Object, fc.Field.Name)
		if !ok {
			return next(ctx)
		}
		subject := ratelimit.SubjectFromContext(ctx)
		if policy == ratelimit.PolicyAI {
			d, release := limiter.GuardAI(ctx, subject)
			if !d.Allowed {
				ratelimit.SetRetryAfter(ctx, retryMs(d))
				return nil, mapDomainError(domain.NewRateLimitedError(string(policy), d.RetryAfter))
			}
			defer release()
			return next(ctx)
		}
		d := limiter.Allow(ctx, policy, subject)
		if !d.Allowed {
			ratelimit.SetRetryAfter(ctx, retryMs(d))
			return nil, mapDomainError(domain.NewRateLimitedError(string(policy), d.RetryAfter))
		}
		return next(ctx)
	}
}

func retryMs(d ratelimit.Decision) int64 {
	ms := d.RetryAfter.Milliseconds()
	if ms < 1 {
		ms = 1
	}
	return ms
}
