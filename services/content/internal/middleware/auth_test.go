package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/config"
	"github.com/stretchr/testify/assert"
)

func TestAuthMiddleware(t *testing.T) {
	secret := "test_secret"
	cfg := &config.Config{JwtSecret: secret}

	tests := []struct {
		name           string
		tokenGenerator func() string
		expectUserID   string
	}{
		{
			name: "NoToken",
			tokenGenerator: func() string {
				return ""
			},
			expectUserID: "",
		},
		{
			name: "ValidToken",
			tokenGenerator: func() string {
				token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
					"id": "user123",
					"exp": time.Now().Add(time.Hour).Unix(),
				})
				s, _ := token.SignedString([]byte(secret))
				return "Bearer " + s
			},
			expectUserID: "user123",
		},
		{
			name: "InvalidSignature",
			tokenGenerator: func() string {
				token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
					"id": "user123",
				})
				s, _ := token.SignedString([]byte("wrong_secret"))
				return "Bearer " + s
			},
			expectUserID: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := AuthMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				userID, ok := r.Context().Value(UserIDKey).(string)
				if !ok {
					userID = ""
				}
				if userID != tt.expectUserID {
					t.Errorf("expected userID %s, got %s", tt.expectUserID, userID)
				}
				w.WriteHeader(http.StatusOK)
			}))

			req := httptest.NewRequest("GET", "/", nil)
			token := tt.tokenGenerator()
			if token != "" {
				req.Header.Set("Authorization", token)
			}

			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code)
		})
	}
}