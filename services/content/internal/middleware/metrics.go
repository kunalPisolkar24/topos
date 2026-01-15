package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/internal/monitoring"
)

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		rw := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		next.ServeHTTP(rw, r)

		duration := time.Since(start).Seconds()
		path := r.URL.Path

		if path == "/query" || path == "/" {
			monitoring.HttpDuration.WithLabelValues(path, r.Method, strconv.Itoa(rw.statusCode)).Observe(duration)
		}
	})
}