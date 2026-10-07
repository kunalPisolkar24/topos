package graph

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/kunalPisolkar24/topos/services/content/internal/middleware"
	"github.com/kunalPisolkar24/topos/services/content/internal/ratelimit"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

func fieldCtx(object, field string) context.Context {
	return graphql.WithFieldContext(context.Background(), &graphql.FieldContext{
		Object: object,
		Field: graphql.CollectedField{
			Field: &ast.Field{Name: field},
		},
	})
}

func authedFieldCtx(userID, object, field string) context.Context {
	return graphql.WithFieldContext(
		middleware.WithUserID(context.Background(), userID),
		&graphql.FieldContext{
			Object: object,
			Field: graphql.CollectedField{
				Field: &ast.Field{Name: field},
			},
		},
	)
}

func testLimiter() *ratelimit.Limiter {
	return ratelimit.New(ratelimit.Limits{
		Enabled:              true,
		Reads:                1,
		Mutations:            1,
		Interactions:         1,
		Search:               1,
		AI:                   1,
		Window:               time.Minute,
		DegradedMultiplier:   1,
		AIDegradedMultiplier: 1,
		AIConcurrency:        5,
		RedisTimeout:         50 * time.Millisecond,
		MemoryMaxEntries:     1000,
	}, nil)
}

func TestFieldPolicyMapping(t *testing.T) {
	cases := []struct {
		object string
		field  string
		policy ratelimit.Policy
		ok     bool
	}{
		{"Query", "posts", ratelimit.PolicyReads, true},
		{"Query", "post", ratelimit.PolicyReads, true},
		{"Query", "tags", ratelimit.PolicyReads, true},
		{"Query", "postsByTag", ratelimit.PolicyReads, true},
		{"Query", "chats", ratelimit.PolicyReads, true},
		{"Query", "postDrafts", ratelimit.PolicyReads, true},
		{"Query", "_entities", ratelimit.PolicyReads, true},
		{"Query", "searchPosts", ratelimit.PolicySearch, true},
		{"Query", "recommendedPosts", ratelimit.PolicySearch, true},
		{"Mutation", "createPost", ratelimit.PolicyMutations, true},
		{"Mutation", "deletePostDraft", ratelimit.PolicyMutations, true},
		{"Mutation", "likePost", ratelimit.PolicyInteractions, true},
		{"Mutation", "recordPostView", ratelimit.PolicyInteractions, true},
		{"Mutation", "generateTags", ratelimit.PolicyAI, true},
		{"Mutation", "generatePostContent", ratelimit.PolicyAI, true},
		{"Mutation", "createPostDraft", ratelimit.PolicyAI, true},
		{"Mutation", "approvePostDraft", ratelimit.PolicyAI, true},
		{"Mutation", "rejectPostDraft", ratelimit.PolicyAI, true},
		{"Mutation", "askChat", ratelimit.PolicyAI, true},
		{"User", "posts", ratelimit.PolicyReads, true},
		// Nested fields inherit the parent budget.
		{"Post", "related", "", false},
		{"Post", "likedByMe", "", false},
		{"Post", "savedByMe", "", false},
		// Introspection never consumes quota.
		{"Query", "__schema", "", false},
		{"Query", "_service", "", false},
		{"Unknown", "posts", "", false},
	}
	for _, tc := range cases {
		policy, ok := fieldPolicy(tc.object, tc.field)
		assert.Equal(t, tc.ok, ok, "%s.%s", tc.object, tc.field)
		assert.Equal(t, tc.policy, policy, "%s.%s", tc.object, tc.field)
	}
}

func TestFieldRateLimitNilLimiterPasses(t *testing.T) {
	called := false
	out, err := FieldRateLimit(nil)(fieldCtx("Query", "posts"), func(_ context.Context) (any, error) {
		called = true
		return "ok", nil
	})
	require.NoError(t, err)
	assert.Equal(t, "ok", out)
	assert.True(t, called)
}

func TestFieldRateLimitRejectsWhenExhausted(t *testing.T) {
	limiter := testLimiter()
	mw := FieldRateLimit(limiter)
	next := func(_ context.Context) (any, error) { return "ok", nil }

	out, err := mw(authedFieldCtx("u_1", "Query", "posts"), next)
	require.NoError(t, err)
	assert.Equal(t, "ok", out)

	_, err = mw(authedFieldCtx("u_1", "Query", "posts"), next)
	require.Error(t, err)
	gqlErr, ok := err.(*gqlerror.Error)
	require.True(t, ok, "rejection is a GraphQL error")
	assert.Equal(t, "RATE_LIMITED", gqlErr.Extensions["code"])
	assert.Equal(t, "reads", gqlErr.Extensions["policy"])
	assert.Greater(t, gqlErr.Extensions["retryAfterMs"], int64(0))
}

func TestFieldRateLimitPreventsAICall(t *testing.T) {
	limiter := testLimiter()
	mw := FieldRateLimit(limiter)
	calls := 0
	aiNext := func(_ context.Context) (any, error) {
		calls++
		return []string{"go"}, nil
	}
	ctx := authedFieldCtx("u_9", "Mutation", "generateTags")

	_, err := mw(ctx, aiNext)
	require.NoError(t, err)
	require.Equal(t, 1, calls)

	_, err = mw(ctx, aiNext)
	require.Error(t, err)
	assert.Equal(t, 1, calls, "the AI path never runs once the quota is exhausted")
}

func TestFieldRateLimitSetsRetryAfterHeader(t *testing.T) {
	limiter := testLimiter()
	mw := FieldRateLimit(limiter)
	next := func(_ context.Context) (any, error) { return "ok", nil }
	run := func(rec *httptest.ResponseRecorder) error {
		var runErr error
		ratelimit.Middleware(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
			ctx := middleware.WithUserID(r.Context(), "u_7")
			ctx = graphql.WithFieldContext(ctx, &graphql.FieldContext{
				Object: "Query",
				Field:  graphql.CollectedField{Field: &ast.Field{Name: "posts"}},
			})
			_, runErr = mw(ctx, next)
		})).ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/query", nil))
		return runErr
	}

	require.NoError(t, run(httptest.NewRecorder()))

	rec := httptest.NewRecorder()
	require.Error(t, run(rec))
	assert.NotEmpty(t, rec.Header().Get("Retry-After"),
		"rejections set Retry-After before gqlgen writes the response")
}
