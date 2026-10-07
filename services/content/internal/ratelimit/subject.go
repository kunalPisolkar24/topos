package ratelimit

import (
	"context"
	"net"
	"net/http"
	"strings"
)

// contextKey isolates the values this package stores on requests.
type contextKey string

const (
	clientIPKey contextKey = "ratelimit-client-ip"
	writerKey   contextKey = "ratelimit-writer"
)

// Middleware extracts the client IP and stores the ResponseWriter so
// resolvers can set Retry-After before gqlgen writes the response.
// It runs after AuthMiddleware so the user id is already in context.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if ip := ClientIPFromRequest(r); ip != "" {
			ctx = context.WithValue(ctx, clientIPKey, ip)
		}
		ctx = context.WithValue(ctx, writerKey, w)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ClientIPFromContext returns the IP stored by Middleware, if any.
func ClientIPFromContext(ctx context.Context) (string, bool) {
	ip, ok := ctx.Value(clientIPKey).(string)
	return ip, ok && ip != ""
}

// SetRetryAfter sets the Retry-After header (whole seconds, minimum 1)
// on the stored writer. It is a no-op without a writer in context and
// must be called before the response is written, which holds for
// resolver-time calls because gqlgen writes after resolution.
func SetRetryAfter(ctx context.Context, retryAfterMs int64) {
	if retryAfterMs < 0 {
		retryAfterMs = 0
	}
	secs := (retryAfterMs + 999) / 1000
	if secs < 1 {
		secs = 1
	}
	w, ok := ctx.Value(writerKey).(http.ResponseWriter)
	if !ok || w == nil {
		return
	}
	w.Header().Set("Retry-After", itoa(secs))
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}

// ClientIPFromRequest derives the caller IP for unauthenticated quota
// keys. X-Forwarded-For (first entry) wins when the gateway sets it,
// then X-Real-IP, then the connection address. Unparseable values fall
// back to unknown so a spoofed header can never inject key content.
func ClientIPFromRequest(r *http.Request) string {
	if r == nil {
		return "unknown"
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if first := strings.TrimSpace(strings.Split(xff, ",")[0]); first != "" {
			if ip := normalizeIP(first); ip != "" {
				return ip
			}
		}
	}
	if xr := strings.TrimSpace(r.Header.Get("X-Real-IP")); xr != "" {
		if ip := normalizeIP(xr); ip != "" {
			return ip
		}
	}
	if host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr)); err == nil {
		if ip := normalizeIP(host); ip != "" {
			return ip
		}
	} else if ip := normalizeIP(strings.TrimSpace(r.RemoteAddr)); ip != "" {
		return ip
	}
	return "unknown"
}

func normalizeIP(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || len(raw) > 64 || strings.ContainsAny(raw, "\r\n") {
		return ""
	}
	if parsed := net.ParseIP(raw); parsed != nil {
		return parsed.String()
	}
	return ""
}
