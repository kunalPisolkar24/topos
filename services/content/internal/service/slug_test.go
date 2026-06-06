package service

import (
	"strings"
	"testing"
)

func TestGenerateSlug(t *testing.T) {
	tests := []struct {
		name  string
		input string
		check func(t *testing.T, slug string)
	}{
		{
			name:  "Simple title",
			input: "Hello World",
			check: func(t *testing.T, slug string) {
				if !strings.HasPrefix(slug, "hello-world-") {
					t.Errorf("expected slug to start with 'hello-world-', got %q", slug)
				}
			},
		},
		{
			name:  "With punctuation",
			input: "Hello, World!",
			check: func(t *testing.T, slug string) {
				if !strings.HasPrefix(slug, "hello-world-") {
					t.Errorf("expected slug to start with 'hello-world-', got %q", slug)
				}
			},
		},
		{
			name:  "Multiple spaces collapse",
			input: "Hello    World",
			check: func(t *testing.T, slug string) {
				if !strings.HasPrefix(slug, "hello-world-") {
					t.Errorf("expected slug to start with 'hello-world-', got %q", slug)
				}
			},
		},
		{
			name:  "Already has dashes",
			input: "Hello-World",
			check: func(t *testing.T, slug string) {
				if !strings.HasPrefix(slug, "hello-world-") {
					t.Errorf("expected slug to start with 'hello-world-', got %q", slug)
				}
			},
		},
		{
			name:  "Leading and trailing spaces",
			input: "  Hello World  ",
			check: func(t *testing.T, slug string) {
				if !strings.HasPrefix(slug, "hello-world-") {
					t.Errorf("expected slug to start with 'hello-world-', got %q", slug)
				}
			},
		},
		{
			name:  "Empty title falls back",
			input: "",
			check: func(t *testing.T, slug string) {
				if !strings.HasPrefix(slug, "post-") {
					t.Errorf("expected fallback slug starting with 'post-', got %q", slug)
				}
			},
		},
		{
			name:  "Only punctuation falls back",
			input: "!!!",
			check: func(t *testing.T, slug string) {
				if !strings.HasPrefix(slug, "post-") {
					t.Errorf("expected fallback slug starting with 'post-', got %q", slug)
				}
			},
		},
		{
			name:  "Leading punctuation stripped",
			input: "!!!Hello",
			check: func(t *testing.T, slug string) {
				if !strings.HasPrefix(slug, "hello-") {
					t.Errorf("expected slug to start with 'hello-', got %q", slug)
				}
			},
		},
		{
			name:  "Numbers preserved",
			input: "Top 10 Tips",
			check: func(t *testing.T, slug string) {
				if !strings.HasPrefix(slug, "top-10-tips-") {
					t.Errorf("expected slug to start with 'top-10-tips-', got %q", slug)
				}
			},
		},
		{
			name:  "Underscores treated as separators",
			input: "hello_world",
			check: func(t *testing.T, slug string) {
				if !strings.HasPrefix(slug, "hello-world-") {
					t.Errorf("expected slug to start with 'hello-world-', got %q", slug)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			slug := generateSlug(tt.input)
			tt.check(t, slug)
		})
	}
}

func TestGenerateSlug_HasTimestamp(t *testing.T) {
	slug := generateSlug("Test")
	parts := strings.Split(slug, "-")
	if len(parts) < 2 {
		t.Fatalf("expected slug to have at least one dash separator, got %q", slug)
	}
	timestamp := parts[len(parts)-1]
	if len(timestamp) != 14 {
		t.Errorf("expected timestamp length 14, got %d (slug: %q)", len(timestamp), slug)
	}
}
