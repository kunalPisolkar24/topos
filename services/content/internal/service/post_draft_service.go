package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/kunalPisolkar24/topos/services/content/internal/domain"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// maxDraftPromptLen mirrors the AI service's MAX_POST_CHARS so oversized
// prompts fail fast at the content boundary.
const maxDraftPromptLen = 5000

// PostDraftService drives the peer-review flow: an author creates a
// paused AI draft, a *different* user approves or rejects it, and only
// approval publishes the post through the regular CreatePost path.
type PostDraftService struct {
	draftRepo   domain.PostDraftRepository
	aiService   domain.AIService
	postService *PostService
	clock       func() time.Time
}

func NewPostDraftService(
	draftRepo domain.PostDraftRepository,
	aiService domain.AIService,
	postService *PostService,
) *PostDraftService {
	return &PostDraftService{
		draftRepo:   draftRepo,
		aiService:   aiService,
		postService: postService,
		clock:       time.Now,
	}
}

// humanApprovalPrefix marks drafts authored by humans: they carry no AI
// workflow, so approval publishes the stored content directly and
// rejection needs no AI call.
const humanApprovalPrefix = "human-"

func isHumanDraft(draft *domain.PostDraft) bool {
	return draft != nil && strings.HasPrefix(draft.ApprovalID, humanApprovalPrefix)
}

func newHumanApprovalID() string {
	return humanApprovalPrefix + primitive.NewObjectID().Hex()
}

func (s *PostDraftService) CreateDraft(ctx context.Context, prompt, authorID string) (*domain.PostDraft, error) {
	if authorID == "" {
		return nil, domain.ErrUnauthorized
	}
	if len(prompt) > maxDraftPromptLen {
		return nil, fmt.Errorf("%w: prompt exceeds %d characters", domain.ErrValidation, maxDraftPromptLen)
	}

	generated, err := s.aiService.GeneratePostDraft(ctx, prompt)
	if err != nil {
		return nil, err
	}

	now := s.clock()
	draft := &domain.PostDraft{
		ApprovalID: generated.ApprovalID,
		Prompt:     prompt,
		Title:      generated.Title,
		Body:       generated.Body,
		Summary:    generated.Summary,
		Tags:       generated.Tags,
		Status:     domain.DraftStatusPending,
		AuthorID:   authorID,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	return s.draftRepo.Create(ctx, draft)
}

// CreateContentDraft files human-authored content for peer review.
// PostID empty means a brand-new post; set means a revision proposal for
// that live post. One pending draft per post per author: resubmitting a
// revision while one is pending updates it in place instead of
// queue-spamming.
func (s *PostDraftService) CreateContentDraft(
	ctx context.Context, authorID string, params domain.ContentDraftParams,
) (*domain.PostDraft, error) {
	if authorID == "" {
		return nil, domain.ErrUnauthorized
	}
	title, body, summary, tags, err := normalizeContentDraft(params)
	if err != nil {
		return nil, err
	}

	now := s.clock()
	if params.PostID != "" {
		existing, err := s.draftRepo.FindPendingByAuthorAndPost(ctx, authorID, params.PostID)
		if err == nil {
			existing.Title = title
			existing.Body = body
			existing.Summary = summary
			existing.Tags = tags
			if params.ImageURL != nil {
				existing.ImageURL = params.ImageURL
			}
			return s.draftRepo.Update(ctx, existing)
		}
		if !errors.Is(err, domain.ErrNotFound) {
			return nil, err
		}
	}

	prompt := title
	if params.PostID != "" {
		prompt = "Revision proposal for " + params.PostID
	}
	draft := &domain.PostDraft{
		ApprovalID: newHumanApprovalID(),
		Prompt:     prompt,
		Title:      title,
		Body:       body,
		Summary:    summary,
		Tags:       tags,
		ImageURL:   params.ImageURL,
		Status:     domain.DraftStatusPending,
		AuthorID:   authorID,
		PostID:     params.PostID,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	return s.draftRepo.Create(ctx, draft)
}

// ResubmitContentDraft lets the author send a rejected draft back to the
// queue with edits; the draft flips to PENDING so it re-enters review.
func (s *PostDraftService) ResubmitContentDraft(
	ctx context.Context, id, authorID string, params domain.ContentDraftParams,
) (*domain.PostDraft, error) {
	draft, err := s.draftRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if draft.AuthorID != authorID {
		return nil, fmt.Errorf("%w: only the author can resubmit", domain.ErrForbidden)
	}
	if draft.Status != domain.DraftStatusRejected {
		return nil, fmt.Errorf("%w: only rejected drafts can be resubmitted", domain.ErrValidation)
	}

	title, body, summary, tags, err := normalizeContentDraft(params)
	if err != nil {
		return nil, err
	}
	if title == draft.Title && body == draft.Body && summary == draft.Summary &&
		equalStrings(tags, draft.Tags) && equalImageURL(params.ImageURL, draft.ImageURL) {
		return nil, fmt.Errorf("%w: no changes to resubmit", domain.ErrValidation)
	}

	draft.Title = title
	draft.Body = body
	draft.Summary = summary
	draft.Tags = tags
	// The resubmit dialog edits text only; a missing cover means "keep
	// the stored one", never "clear it".
	if params.ImageURL != nil {
		draft.ImageURL = params.ImageURL
	}
	draft.Status = domain.DraftStatusPending
	draft.ReviewedByID = ""
	draft.ReviewedAt = time.Time{}
	draft.RejectionNote = ""
	return s.draftRepo.Update(ctx, draft)
}

func normalizeContentDraft(params domain.ContentDraftParams) (title, body, summary string, tags []string, err error) {
	if title, err = normalizeTitle(params.Title); err != nil {
		return "", "", "", nil, err
	}
	if body, err = normalizeBody(params.Body); err != nil {
		return "", "", "", nil, err
	}
	if tags, err = normalizeTags(params.Tags); err != nil {
		return "", "", "", nil, err
	}
	return title, body, strings.TrimSpace(params.Summary), tags, nil
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func equalImageURL(a, b *string) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// ListCommunity returns pending drafts from everyone except the
// requester: the queue a reviewer acts on.
func (s *PostDraftService) ListCommunity(ctx context.Context, viewerID string, page, limit int) (*domain.PaginatedPostDrafts, error) {
	if viewerID == "" {
		return nil, domain.ErrUnauthorized
	}
	return s.draftRepo.FindPendingExceptAuthor(ctx, viewerID, page, limit)
}

// ListMine returns the requester's own drafts in every state, newest
// first; authors manage (withdraw) them from here.
func (s *PostDraftService) ListMine(ctx context.Context, authorID string, page, limit int) (*domain.PaginatedPostDrafts, error) {
	if authorID == "" {
		return nil, domain.ErrUnauthorized
	}
	return s.draftRepo.FindByAuthor(ctx, authorID, page, limit)
}

// ApproveDraft resumes the paused AI workflow and publishes the post as
// the original author. The reviewer may pass edits that are applied to
// the workflow before it resumes. The atomic status claim is what makes
// concurrent approvals safe: exactly one reviewer's call transitions
// the draft and publishes; the rest fail with ErrConflict.
func (s *PostDraftService) ApproveDraft(
	ctx context.Context, id, actorID string, review *domain.DraftReview,
) (*domain.PostDraft, error) {
	draft, err := s.authorizedDraft(ctx, id, actorID)
	if err != nil {
		return nil, err
	}

	if isHumanDraft(draft) {
		return s.approveHumanDraft(ctx, draft, actorID, review)
	}

	final, err := s.aiService.ApprovePost(ctx, draft.ApprovalID, review)
	if err != nil {
		return nil, err
	}

	claimed, err := s.draftRepo.TransitionStatus(
		ctx, id, []domain.DraftStatus{domain.DraftStatusPending, domain.DraftStatusRejected},
		domain.DraftStatusApproved,
	)
	if err != nil {
		return nil, err
	}
	draft = claimed

	// The AI summary ships with the approval, so the summary worker has
	// nothing left to regenerate.
	publishedSummary := final.Summary
	post, err := s.postService.CreatePost(
		ctx, final.Title, final.Body, draft.AuthorID, final.Tags, nil, &publishedSummary, actorID,
	)
	if err != nil {
		return nil, err
	}

	now := s.clock()
	draft.Status = domain.DraftStatusApproved
	draft.Title = final.Title
	draft.Body = final.Body
	draft.Summary = final.Summary
	draft.Tags = final.Tags
	draft.PostID = post.ID
	draft.ReviewedByID = actorID
	draft.ReviewedAt = now
	draft.RejectionNote = ""
	return s.draftRepo.Update(ctx, draft)
}

// approveHumanDraft publishes a human-authored draft as-is: no AI
// workflow exists, so reviewer edits merge onto the stored content and
// the post goes through the regular CreatePost path (or UpdatePost for
// revision proposals) as the original author.
func (s *PostDraftService) approveHumanDraft(
	ctx context.Context, draft *domain.PostDraft, actorID string, review *domain.DraftReview,
) (*domain.PostDraft, error) {
	title, body, summary, tags := draft.Title, draft.Body, draft.Summary, draft.Tags
	if review != nil {
		if review.Title != nil {
			title = *review.Title
		}
		if review.Body != nil {
			body = *review.Body
		}
		if review.Summary != nil {
			summary = *review.Summary
		}
		if review.Tags != nil {
			tags = review.Tags
		}
	}
	var err error
	if title, err = normalizeTitle(title); err != nil {
		return nil, err
	}
	if body, err = normalizeBody(body); err != nil {
		return nil, err
	}
	if tags, err = normalizeTags(tags); err != nil {
		return nil, err
	}
	summary = strings.TrimSpace(summary)

	claimed, err := s.draftRepo.TransitionStatus(
		ctx, draft.ID, []domain.DraftStatus{domain.DraftStatusPending, domain.DraftStatusRejected},
		domain.DraftStatusApproved,
	)
	if err != nil {
		return nil, err
	}
	draft = claimed

	var postID string
	if draft.PostID != "" {
		updated, err := s.postService.UpdatePost(
			ctx, draft.PostID, draft.AuthorID, &title, &body, tags, draft.ImageURL, actorID,
		)
		if err != nil && !errors.Is(err, domain.ErrNotFound) {
			return nil, err
		}
		if err != nil {
			// The linked post is gone; fall back to publishing fresh.
			postID, err = s.publishHumanPost(ctx, draft, actorID, title, body, summary, tags)
			if err != nil {
				return nil, err
			}
		} else {
			postID = updated.ID
		}
	} else {
		var err error
		postID, err = s.publishHumanPost(ctx, draft, actorID, title, body, summary, tags)
		if err != nil {
			return nil, err
		}
	}

	draft.Status = domain.DraftStatusApproved
	draft.Title = title
	draft.Body = body
	draft.Summary = summary
	draft.Tags = tags
	draft.PostID = postID
	draft.ReviewedByID = actorID
	draft.ReviewedAt = s.clock()
	draft.RejectionNote = ""
	return s.draftRepo.Update(ctx, draft)
}

func (s *PostDraftService) publishHumanPost(
	ctx context.Context, draft *domain.PostDraft, actorID, title, body, summary string, tags []string,
) (string, error) {
	publishedSummary := summary
	post, err := s.postService.CreatePost(
		ctx, title, body, draft.AuthorID, tags, draft.ImageURL, &publishedSummary, actorID,
	)
	if err != nil {
		return "", err
	}
	return post.ID, nil
}

// RejectDraft records a rejection from a peer. Rejections stay
// resumable by design, so this is only allowed on pending drafts;
// rejecting twice is treated as idempotent success because the outcome
// is identical for every loser of the race.
func (s *PostDraftService) RejectDraft(ctx context.Context, id, actorID string, reason string) (*domain.PostDraft, error) {
	draft, err := s.authorizedDraft(ctx, id, actorID)
	if err != nil {
		return nil, err
	}
	if draft.Status == domain.DraftStatusRejected {
		return draft, nil
	}
	if draft.Status != domain.DraftStatusPending {
		return nil, fmt.Errorf("%w: approved drafts cannot be rejected", domain.ErrValidation)
	}

	// Human-authored drafts carry no AI workflow to reject.
	if !isHumanDraft(draft) {
		if err := s.aiService.RejectPost(ctx, draft.ApprovalID, reason); err != nil {
			return nil, err
		}
	}

	rejected, err := s.draftRepo.TransitionStatus(
		ctx, id, []domain.DraftStatus{domain.DraftStatusPending}, domain.DraftStatusRejected,
	)
	if errors.Is(err, domain.ErrConflict) {
		// Another reviewer rejected first; same outcome either way.
		return s.draftRepo.FindByID(ctx, id)
	}
	if err != nil {
		return nil, err
	}
	rejected.ReviewedByID = actorID
	rejected.ReviewedAt = s.clock()
	rejected.RejectionNote = reason
	return s.draftRepo.Update(ctx, rejected)
}

// WithdrawDraft lets the author delete their own still-pending draft.
func (s *PostDraftService) WithdrawDraft(ctx context.Context, id, actorID string) error {
	draft, err := s.draftRepo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if draft.AuthorID != actorID {
		return domain.ErrForbidden
	}
	if draft.Status != domain.DraftStatusPending {
		return fmt.Errorf("%w: only pending drafts can be withdrawn", domain.ErrValidation)
	}
	return s.draftRepo.Delete(ctx, id)
}

// authorizedDraft loads the draft and enforces the peer-review rule:
// the author can never act on their own draft.
func (s *PostDraftService) authorizedDraft(ctx context.Context, id, actorID string) (*domain.PostDraft, error) {
	if actorID == "" {
		return nil, domain.ErrUnauthorized
	}
	draft, err := s.draftRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if draft.AuthorID == actorID {
		return nil, fmt.Errorf("%w: drafts must be reviewed by another user", domain.ErrForbidden)
	}
	return draft, nil
}
