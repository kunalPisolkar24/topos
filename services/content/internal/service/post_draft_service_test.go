package service

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/kunalPisolkar24/topos/services/content/internal/domain"
	"github.com/kunalPisolkar24/topos/services/content/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	draftAuthorID = "author_1"
	draftPeerID   = "peer_1"
)

func newDraftService(
	t *testing.T,
	draftRepo *testutil.MockPostDraftRepository,
	ai *testutil.MockAIService,
	postRepo *testutil.MockPostRepository,
) *PostDraftService {
	t.Helper()

	if draftRepo == nil {
		draftRepo = &testutil.MockPostDraftRepository{}
	}
	if ai == nil {
		ai = &testutil.MockAIService{}
	}
	return NewPostDraftService(draftRepo, ai, newService(t, postRepo, nil, nil))
}

func pendingDraft(id string) *domain.PostDraft {
	return &domain.PostDraft{
		ID:         id,
		ApprovalID: "approval-" + id,
		Title:      "Generated title",
		Body:       "Generated body",
		Summary:    "Generated summary",
		Tags:       []string{"ai"},
		Status:     domain.DraftStatusPending,
		AuthorID:   draftAuthorID,
	}
}

func TestCreateDraftGeneratesAndPersists(t *testing.T) {
	var capturedPrompt string
	ai := &testutil.MockAIService{GenerateDraftFn: func(ctx context.Context, prompt string) (*domain.GeneratedDraft, error) {
		capturedPrompt = prompt
		return &domain.GeneratedDraft{
			GeneratedPost: domain.GeneratedPost{
				Title:   "T",
				Body:    "B",
				Summary: "S",
				Tags:    []string{"tag"},
			},
			ApprovalID: "ap-1",
		}, nil
	}}
	repo := &testutil.MockPostDraftRepository{}
	s := newDraftService(t, repo, ai, nil)

	draft, err := s.CreateDraft(context.Background(), "write about kafka", draftAuthorID)
	require.NoError(t, err)
	assert.Equal(t, "write about kafka", capturedPrompt)
	assert.Equal(t, "ap-1", draft.ApprovalID)
	assert.Equal(t, "T", draft.Title)
	assert.Equal(t, domain.DraftStatusPending, draft.Status)
	assert.Equal(t, draftAuthorID, draft.AuthorID)
}

func TestCreateDraftValidatesInput(t *testing.T) {
	s := newDraftService(t, nil, nil, nil)

	long := make([]byte, maxDraftPromptLen+1)
	_, err := s.CreateDraft(context.Background(), string(long), draftAuthorID)
	require.ErrorIs(t, err, domain.ErrValidation)

	_, err = s.CreateDraft(context.Background(), "prompt", "")
	require.ErrorIs(t, err, domain.ErrUnauthorized)
}

func TestApproveDraftForbiddenForAuthor(t *testing.T) {
	draftRepo := &testutil.MockPostDraftRepository{FindByIDFn: func(ctx context.Context, id string) (*domain.PostDraft, error) {
		return pendingDraft("d1"), nil
	}}
	s := newDraftService(t, draftRepo, nil, nil)

	_, err := s.ApproveDraft(context.Background(), "d1", draftAuthorID, nil)
	require.ErrorIs(t, err, domain.ErrForbidden)
}

func TestApproveDraftPublishesPostThroughCreatePath(t *testing.T) {
	var published *domain.Post
	postRepo := &testutil.MockPostRepository{CreateFn: func(ctx context.Context, post *domain.Post) (*domain.Post, error) {
		published = post
		post.ID = "post-created"
		return post, nil
	}}
	ai := &testutil.MockAIService{ApprovePostFn: func(ctx context.Context, approvalID string, review *domain.DraftReview) (*domain.GeneratedPost, error) {
		require.NotNil(t, review)
		require.NotNil(t, review.Title)
		assert.Equal(t, "Reviewer title", *review.Title)
		return &domain.GeneratedPost{Title: "Reviewer title", Body: "B", Summary: "S", Tags: []string{"t"}}, nil
	}}
	draftRepo := &testutil.MockPostDraftRepository{
		FindByIDFn: func(ctx context.Context, id string) (*domain.PostDraft, error) {
			return pendingDraft("d1"), nil
		},
		TransitionStatusFn: func(ctx context.Context, id string, from []domain.DraftStatus, to domain.DraftStatus) (*domain.PostDraft, error) {
			claimed := pendingDraft(id)
			claimed.Status = to
			return claimed, nil
		},
	}
	s := newDraftService(t, draftRepo, ai, postRepo)

	title := "Reviewer title"
	draft, err := s.ApproveDraft(context.Background(), "d1", draftPeerID, &domain.DraftReview{Title: &title})
	require.NoError(t, err)
	assert.Equal(t, domain.DraftStatusApproved, draft.Status)
	assert.Equal(t, draftAuthorID, draft.AuthorID)
	require.NotNil(t, published, "approval must publish a post through CreatePost")
	assert.Equal(t, draftAuthorID, published.AuthorID, "the post is authored by the draft's author")
	assert.Equal(t, "Reviewer title", published.Title)
	assert.Equal(t, "S", published.Summary, "AI summary ships with the approval")
	assert.Equal(t, draftPeerID, draft.ReviewedByID, "approval records the reviewer")
	assert.False(t, draft.ReviewedAt.IsZero())
}

func TestApproveDraftConflictWhenAlreadyClaimed(t *testing.T) {
	draftRepo := &testutil.MockPostDraftRepository{
		FindByIDFn: func(ctx context.Context, id string) (*domain.PostDraft, error) {
			return pendingDraft("d1"), nil
		},
		TransitionStatusFn: func(ctx context.Context, id string, from []domain.DraftStatus, to domain.DraftStatus) (*domain.PostDraft, error) {
			return nil, fmt.Errorf("%w: draft already reviewed", domain.ErrConflict)
		},
	}
	s := newDraftService(t, draftRepo, nil, nil)

	_, err := s.ApproveDraft(context.Background(), "d1", draftPeerID, nil)
	require.ErrorIs(t, err, domain.ErrConflict)
}

func TestRejectDraftRecordsRejectionOnce(t *testing.T) {
	calls := 0
	ai := &testutil.MockAIService{RejectPostFn: func(ctx context.Context, approvalID string, reason string) error {
		calls++
		assert.Equal(t, "needs work", reason)
		return nil
	}}
	draftRepo := &testutil.MockPostDraftRepository{FindByIDFn: func(ctx context.Context, id string) (*domain.PostDraft, error) {
		return pendingDraft("d1"), nil
	}}
	s := newDraftService(t, draftRepo, ai, nil)

	rejected, err := s.RejectDraft(context.Background(), "d1", draftPeerID, "needs work")
	require.NoError(t, err)
	assert.Equal(t, domain.DraftStatusRejected, rejected.Status)

	already := pendingDraft("d1")
	already.Status = domain.DraftStatusRejected
	draftRepo.FindByIDFn = func(ctx context.Context, id string) (*domain.PostDraft, error) {
		return already, nil
	}
	repeat, err := s.RejectDraft(context.Background(), "d1", draftPeerID, "")
	require.NoError(t, err)
	assert.Equal(t, domain.DraftStatusRejected, repeat.Status)
	assert.Equal(t, 1, calls, "repeat rejection short-circuits before the AI call")
}

func TestRejectDraftCannotTouchApprovedDraft(t *testing.T) {
	draftRepo := &testutil.MockPostDraftRepository{FindByIDFn: func(ctx context.Context, id string) (*domain.PostDraft, error) {
		draft := pendingDraft("d1")
		draft.Status = domain.DraftStatusApproved
		return draft, nil
	}}
	s := newDraftService(t, draftRepo, nil, nil)

	_, err := s.RejectDraft(context.Background(), "d1", draftPeerID, "")
	require.ErrorIs(t, err, domain.ErrValidation)
}

func TestWithdrawDraftOwnerOnlyWhilePending(t *testing.T) {
	deleted := ""
	draftRepo := &testutil.MockPostDraftRepository{
		FindByIDFn: func(ctx context.Context, id string) (*domain.PostDraft, error) {
			return pendingDraft("d1"), nil
		},
		DeleteFn: func(ctx context.Context, id string) error {
			deleted = id
			return nil
		},
	}
	s := newDraftService(t, draftRepo, nil, nil)

	require.NoError(t, s.WithdrawDraft(context.Background(), "d1", draftAuthorID))
	assert.Equal(t, "d1", deleted)

	_, err := s.draftRepo.FindByID(context.Background(), "d1")
	_ = err // author may withdraw; a peer may not
	err = s.WithdrawDraft(context.Background(), "d1", draftPeerID)
	require.ErrorIs(t, err, domain.ErrForbidden)
}

func humanDraft(id string) *domain.PostDraft {
	image := "https://cdn/cover.png"
	return &domain.PostDraft{
		ID:         id,
		ApprovalID: "human-approval-1",
		Prompt:     "Human title",
		Title:      "Human title",
		Body:       "Human body with enough content to pass validation.",
		Summary:    "Human summary",
		Tags:       []string{"human"},
		ImageURL:   &image,
		Status:     domain.DraftStatusPending,
		AuthorID:   draftAuthorID,
	}
}

func humanParams() domain.ContentDraftParams {
	image := "https://cdn/cover.png"
	return domain.ContentDraftParams{
		Title:    "Human title",
		Body:     "Human body with enough content to pass validation.",
		Summary:  "Human summary",
		Tags:     []string{"human"},
		ImageURL: &image,
	}
}

func TestCreateContentDraftPersistsHumanDraft(t *testing.T) {
	aiCalls := 0
	ai := &testutil.MockAIService{GenerateDraftFn: func(ctx context.Context, prompt string) (*domain.GeneratedDraft, error) {
		aiCalls++
		return &domain.GeneratedDraft{ApprovalID: "ap-x"}, nil
	}}
	var created *domain.PostDraft
	repo := &testutil.MockPostDraftRepository{CreateFn: func(ctx context.Context, draft *domain.PostDraft) (*domain.PostDraft, error) {
		created = draft
		draft.ID = "draft-human"
		return draft, nil
	}}
	s := newDraftService(t, repo, ai, nil)

	draft, err := s.CreateContentDraft(context.Background(), draftAuthorID, humanParams())
	require.NoError(t, err)
	assert.Equal(t, 0, aiCalls, "human drafts must not touch the AI workflow")
	require.NotNil(t, created)
	assert.True(t, strings.HasPrefix(created.ApprovalID, "human-"), "human drafts carry a local approval id")
	assert.Equal(t, "Human title", created.Prompt)
	assert.Equal(t, "Human title", draft.Title)
	assert.Equal(t, "Human summary", draft.Summary)
	assert.Equal(t, []string{"human"}, draft.Tags)
	require.NotNil(t, draft.ImageURL)
	assert.Equal(t, "https://cdn/cover.png", *draft.ImageURL)
	assert.Equal(t, domain.DraftStatusPending, draft.Status)
	assert.Equal(t, draftAuthorID, draft.AuthorID)
}

func TestCreateContentDraftValidatesInput(t *testing.T) {
	s := newDraftService(t, nil, nil, nil)

	bad := humanParams()
	bad.Title = "   "
	_, err := s.CreateContentDraft(context.Background(), draftAuthorID, bad)
	require.ErrorIs(t, err, domain.ErrValidation)

	_, err = s.CreateContentDraft(context.Background(), "", humanParams())
	require.ErrorIs(t, err, domain.ErrUnauthorized)
}

func TestCreateContentDraftMergesIntoPendingRevision(t *testing.T) {
	existing := humanDraft("d1")
	existing.PostID = "post-1"
	var updated *domain.PostDraft
	repo := &testutil.MockPostDraftRepository{
		FindPendingByAuthorAndPostFn: func(ctx context.Context, authorID, postID string) (*domain.PostDraft, error) {
			assert.Equal(t, draftAuthorID, authorID)
			assert.Equal(t, "post-1", postID)
			return existing, nil
		},
		UpdateFn: func(ctx context.Context, draft *domain.PostDraft) (*domain.PostDraft, error) {
			updated = draft
			return draft, nil
		},
		CreateFn: func(ctx context.Context, draft *domain.PostDraft) (*domain.PostDraft, error) {
			t.Fatal("pending revision must update in place, not create")
			return draft, nil
		},
	}
	s := newDraftService(t, repo, nil, nil)

	params := humanParams()
	params.PostID = "post-1"
	params.Title = "Revised title"
	draft, err := s.CreateContentDraft(context.Background(), draftAuthorID, params)
	require.NoError(t, err)
	require.NotNil(t, updated)
	assert.Equal(t, "Revised title", draft.Title)
	assert.Equal(t, "d1", draft.ID)
}

func TestResubmitContentDraftReopensRejected(t *testing.T) {
	rejected := humanDraft("d1")
	rejected.Status = domain.DraftStatusRejected
	rejected.ReviewedByID = draftPeerID
	rejected.RejectionNote = "needs work"
	repo := &testutil.MockPostDraftRepository{
		FindByIDFn: func(ctx context.Context, id string) (*domain.PostDraft, error) {
			return rejected, nil
		},
	}
	s := newDraftService(t, repo, nil, nil)

	params := humanParams()
	params.Title = "Fixed title"
	draft, err := s.ResubmitContentDraft(context.Background(), "d1", draftAuthorID, params)
	require.NoError(t, err)
	assert.Equal(t, domain.DraftStatusPending, draft.Status)
	assert.Equal(t, "Fixed title", draft.Title)
	assert.Empty(t, draft.ReviewedByID, "resubmission clears the previous review")
	assert.Empty(t, draft.RejectionNote)
}

func TestResubmitContentDraftRejectsBadStates(t *testing.T) {
	repo := &testutil.MockPostDraftRepository{
		FindByIDFn: func(ctx context.Context, id string) (*domain.PostDraft, error) {
			return humanDraft("d1"), nil
		},
	}
	s := newDraftService(t, repo, nil, nil)

	// Only the author may resubmit.
	_, err := s.ResubmitContentDraft(context.Background(), "d1", draftPeerID, humanParams())
	require.ErrorIs(t, err, domain.ErrForbidden)

	// Pending drafts cannot be resubmitted.
	_, err = s.ResubmitContentDraft(context.Background(), "d1", draftAuthorID, humanParams())
	require.ErrorIs(t, err, domain.ErrValidation)

	// Identical content is not a resubmission.
	rejected := humanDraft("d2")
	rejected.Status = domain.DraftStatusRejected
	repo.FindByIDFn = func(ctx context.Context, id string) (*domain.PostDraft, error) {
		return rejected, nil
	}
	_, err = s.ResubmitContentDraft(context.Background(), "d2", draftAuthorID, humanParams())
	require.ErrorIs(t, err, domain.ErrValidation)
}

func TestApproveHumanDraftPublishesStoredContent(t *testing.T) {
	aiCalls := 0
	ai := &testutil.MockAIService{
		ApprovePostFn: func(ctx context.Context, approvalID string, review *domain.DraftReview) (*domain.GeneratedPost, error) {
			aiCalls++
			return &domain.GeneratedPost{}, nil
		},
	}
	var published *domain.Post
	postRepo := &testutil.MockPostRepository{CreateFn: func(ctx context.Context, post *domain.Post) (*domain.Post, error) {
		published = post
		post.ID = "post-created"
		return post, nil
	}}
	draftRepo := &testutil.MockPostDraftRepository{
		FindByIDFn: func(ctx context.Context, id string) (*domain.PostDraft, error) {
			return humanDraft("d1"), nil
		},
		TransitionStatusFn: func(ctx context.Context, id string, from []domain.DraftStatus, to domain.DraftStatus) (*domain.PostDraft, error) {
			claimed := humanDraft(id)
			claimed.Status = to
			return claimed, nil
		},
	}
	s := newDraftService(t, draftRepo, ai, postRepo)

	draft, err := s.ApproveDraft(context.Background(), "d1", draftPeerID, nil)
	require.NoError(t, err)
	assert.Equal(t, 0, aiCalls, "human approval must not resume any AI workflow")
	require.NotNil(t, published, "approval must publish through CreatePost")
	assert.Equal(t, draftAuthorID, published.AuthorID)
	assert.Equal(t, "Human title", published.Title)
	require.NotNil(t, published.ImageUrl)
	assert.Equal(t, "https://cdn/cover.png", *published.ImageUrl)
	assert.Equal(t, draftPeerID, published.ApprovedByID, "published post credits the reviewer")
	assert.Equal(t, domain.DraftStatusApproved, draft.Status)
	assert.Equal(t, "post-created", draft.PostID)
	assert.Equal(t, draftPeerID, draft.ReviewedByID, "approval records the reviewer")
	assert.False(t, draft.ReviewedAt.IsZero())
	assert.Empty(t, draft.RejectionNote)
}

func TestApproveHumanDraftRevisionUpdatesLivePost(t *testing.T) {
	var updatedID string
	var updatedPost *domain.Post
	postRepo := &testutil.MockPostRepository{
		FindByIDFn: func(ctx context.Context, id string) (*domain.Post, error) {
			return &domain.Post{ID: id, AuthorID: draftAuthorID, Title: "Old", Body: "Old body"}, nil
		},
		FindBySlugFn: func(ctx context.Context, slug string) (*domain.Post, error) {
			return nil, domain.ErrNotFound
		},
		UpdateFn: func(ctx context.Context, id string, post *domain.Post) (*domain.Post, error) {
			updatedID = id
			updatedPost = post
			return &domain.Post{ID: id}, nil
		},
	}
	draft := humanDraft("d1")
	draft.PostID = "post-1"
	draftRepo := &testutil.MockPostDraftRepository{
		FindByIDFn: func(ctx context.Context, id string) (*domain.PostDraft, error) {
			return draft, nil
		},
		TransitionStatusFn: func(ctx context.Context, id string, from []domain.DraftStatus, to domain.DraftStatus) (*domain.PostDraft, error) {
			claimed := humanDraft(id)
			claimed.PostID = "post-1"
			claimed.Status = to
			return claimed, nil
		},
	}
	s := newDraftService(t, draftRepo, nil, postRepo)

	approved, err := s.ApproveDraft(context.Background(), "d1", draftPeerID, nil)
	require.NoError(t, err)
	assert.Equal(t, "post-1", updatedID, "revision approval updates the live post")
	require.NotNil(t, updatedPost)
	assert.Equal(t, domain.DraftStatusApproved, approved.Status)
	assert.Equal(t, "post-1", approved.PostID)
	assert.Equal(t, 0, postRepo.CreateCalls, "revision approval must not create a second post")
}

func TestRejectHumanDraftSkipsAI(t *testing.T) {
	calls := 0
	ai := &testutil.MockAIService{RejectPostFn: func(ctx context.Context, approvalID string, reason string) error {
		calls++
		return nil
	}}
	draftRepo := &testutil.MockPostDraftRepository{FindByIDFn: func(ctx context.Context, id string) (*domain.PostDraft, error) {
		return humanDraft("d1"), nil
	}}
	s := newDraftService(t, draftRepo, ai, nil)

	rejected, err := s.RejectDraft(context.Background(), "d1", draftPeerID, "needs work")
	require.NoError(t, err)
	assert.Equal(t, domain.DraftStatusRejected, rejected.Status)
	assert.Equal(t, 0, calls, "human rejection needs no AI call")
	assert.Equal(t, draftPeerID, rejected.ReviewedByID, "rejection records the reviewer")
	assert.Equal(t, "needs work", rejected.RejectionNote)
	assert.False(t, rejected.ReviewedAt.IsZero())
}
