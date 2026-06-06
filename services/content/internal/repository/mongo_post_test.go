package repository

import (
	"testing"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
	"github.com/stretchr/testify/assert"
)

func TestBuildPostUpdateFields_ResetSummary_OverridesExistingValues(t *testing.T) {
	now := time.Now()
	post := &domain.Post{
		UpdatedAt:    now,
		ResetSummary: true,
		Summary:      "stale text from caller",
	}

	fields := buildPostUpdateFields(post)

	assert.Equal(t, now, fields["updatedAt"])
	assert.Equal(t, "", fields["summary"])
	assert.Equal(t, domain.PostStatusPending, fields["summaryStatus"])
	_, hasSummary := fields["summary"]
	assert.True(t, hasSummary)
	_, hasStatus := fields["summaryStatus"]
	assert.True(t, hasStatus)
}

func TestBuildPostUpdateFields_NoReset_KeepsEmptySummaryUntouched(t *testing.T) {
	now := time.Now()
	post := &domain.Post{
		Title:     "New title",
		UpdatedAt: now,
	}

	fields := buildPostUpdateFields(post)

	assert.Equal(t, "New title", fields["title"])
	assert.Equal(t, now, fields["updatedAt"])
	_, hasSummary := fields["summary"]
	assert.False(t, hasSummary)
	_, hasStatus := fields["summaryStatus"]
	assert.False(t, hasStatus)
}

func TestBuildPostUpdateFields_RespectsExplicitSummaryAndStatus(t *testing.T) {
	now := time.Now()
	post := &domain.Post{
		UpdatedAt:     now,
		Summary:       "user provided",
		SummaryStatus: domain.PostStatusCompleted,
	}

	fields := buildPostUpdateFields(post)

	assert.Equal(t, "user provided", fields["summary"])
	assert.Equal(t, domain.PostStatusCompleted, fields["summaryStatus"])
}
