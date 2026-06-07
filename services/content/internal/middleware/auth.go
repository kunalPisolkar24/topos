package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/kunalPisolkar24/blogapp/services/content/internal/config"
)

type ContextKey string

const UserIDKey ContextKey = "userId"

func UserIDFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(UserIDKey).(string)
	return v, ok && v != ""
}

func AuthMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")

			if authHeader == "" {
				next.ServeHTTP(w, r)
				return
			}

			tokenString := strings.Replace(authHeader, "Bearer ", "", 1)
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				return []byte(cfg.JwtSecret), nil
			})

			if err != nil || !token.Valid {
				next.ServeHTTP(w, r)
				return
			}

			if claims, ok := token.Claims.(jwt.MapClaims); ok {
				if id, ok := claims["id"]; ok {
					var userID string
					switch v := id.(type) {
					case float64:
						userID = fmt.Sprintf("%.0f", v)
					case string:
						userID = v
					}

					ctx := context.WithValue(r.Context(), UserIDKey, userID)
					next.ServeHTTP(w, r.WithContext(ctx))
				}
			}
		})
	}
}