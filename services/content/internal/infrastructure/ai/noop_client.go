package ai

import (
	"context"
	"regexp"
	"strings"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
)

type noopAIClient struct{}

var tokenSplitRegex = regexp.MustCompile(`[^a-z0-9]+`)

var stopWords = map[string]struct{}{
	"the": {}, "and": {}, "for": {}, "with": {}, "this": {}, "that": {}, "from": {}, "into": {}, "about": {}, "your": {},
	"you": {}, "are": {}, "was": {}, "were": {}, "will": {}, "have": {}, "has": {}, "had": {}, "not": {}, "but": {},
	"can": {}, "could": {}, "should": {}, "would": {}, "our": {}, "their": {}, "they": {}, "them": {}, "his": {}, "her": {},
	"its": {}, "who": {}, "what": {}, "when": {}, "where": {}, "why": {}, "how": {}, "all": {}, "any": {}, "new": {},
	"post": {}, "blog": {}, "content": {}, "article": {}, "write": {}, "create": {}, "generate": {},
}

func NewNoopAIClient() domain.AIService {
	return &noopAIClient{}
}

func (c *noopAIClient) Close() error {
	return nil
}

func (c *noopAIClient) GenerateSummary(_ context.Context, content string) (string, error) {
	summary := truncateText(normalizeWhitespace(content), 240)
	if summary == "" {
		return "Summary is currently unavailable.", nil
	}
	return summary, nil
}

func (c *noopAIClient) GenerateTags(_ context.Context, title, body string) ([]string, error) {
	return deriveTags(title, body), nil
}

func (c *noopAIClient) GeneratePost(_ context.Context, prompt string) (*domain.GeneratedPost, error) {
	normalized := normalizeWhitespace(prompt)
	title := truncateText(normalized, 64)
	if title == "" {
		title = "Generated Post"
	}

	body := normalized
	if body == "" {
		body = "Content generation is currently running in fallback mode."
	}

	return &domain.GeneratedPost{
		Title:   title,
		Body:    body,
		Summary: truncateText(body, 220),
		Tags:    deriveTags(title, body),
	}, nil
}

func normalizeWhitespace(input string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(input)), " ")
}

func truncateText(input string, max int) string {
	if max <= 0 {
		return ""
	}
	runes := []rune(input)
	if len(runes) <= max {
		return input
	}
	cut := string(runes[:max])
	if idx := strings.LastIndex(cut, " "); idx > 0 {
		cut = cut[:idx]
	}
	return strings.TrimSpace(cut) + "..."
}

func deriveTags(title, body string) []string {
	text := strings.ToLower(title + " " + body)
	tokens := tokenSplitRegex.Split(text, -1)
	seen := make(map[string]struct{})
	tags := make([]string, 0, 5)

	for _, token := range tokens {
		if len(token) < 3 {
			continue
		}
		if _, blocked := stopWords[token]; blocked {
			continue
		}
		if _, exists := seen[token]; exists {
			continue
		}
		seen[token] = struct{}{}
		tags = append(tags, token)
		if len(tags) == 5 {
			break
		}
	}

	if len(tags) == 0 {
		return []string{"general"}
	}

	return tags
}
