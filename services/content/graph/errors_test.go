package graph

import (
	"errors"
	"testing"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/domain"
)

func TestMapDomainError(t *testing.T) {
	tests := []struct {
		name        string
		input       error
		wantMessage string
	}{
		{"unauthorized", domain.ErrUnauthorized, "unauthorized"},
		{"forbidden", domain.ErrForbidden, "forbidden"},
		{"not found", domain.ErrNotFound, "not found"},
		{"wrapped not found", errors.New("wrap: " + domain.ErrNotFound.Error()), ""},
		{"unknown", errors.New("something else"), "something else"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := mapDomainError(tt.input)
			if got == nil {
				t.Fatal("expected non-nil error")
			}
			if tt.wantMessage != "" && got.Message != tt.wantMessage {
				t.Errorf("expected message %q, got %q", tt.wantMessage, got.Message)
			}
		})
	}
}
