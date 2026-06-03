package middleware

import (
	"fmt"
	"net/http"

	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
)

func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				logger.Error("Panic recovered",
					"error", fmt.Sprintf("%v", rec),
					"path", r.URL.Path,
					"method", r.Method,
				)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
