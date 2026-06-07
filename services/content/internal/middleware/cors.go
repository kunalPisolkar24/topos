package middleware

import (
	"net/http"
	"strconv"
	"strings"
)

type CORSConfig struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	ExposedHeaders   []string
	AllowCredentials bool
	MaxAgeSeconds    int
}

func DefaultCORSConfig() CORSConfig {
	return CORSConfig{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type", "Apollo-Require-Preflight"},
		ExposedHeaders: []string{},
		MaxAgeSeconds:  86400,
	}
}

func CORS(cfg CORSConfig) func(http.Handler) http.Handler {
	allowedOrigins := make(map[string]struct{}, len(cfg.AllowedOrigins))
	permissive := false
	for _, o := range cfg.AllowedOrigins {
		if o == "*" {
			permissive = true
			break
		}
		allowedOrigins[strings.TrimSpace(o)] = struct{}{}
	}

	allowedMethods := strings.Join(cfg.AllowedMethods, ", ")
	allowedHeaders := strings.Join(cfg.AllowedHeaders, ", ")
	exposedHeaders := strings.Join(cfg.ExposedHeaders, ", ")

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				if permissive {
					w.Header().Set("Access-Control-Allow-Origin", "*")
				} else if _, ok := allowedOrigins[origin]; ok {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Add("Vary", "Origin")
				} else {
					http.Error(w, "origin not allowed", http.StatusForbidden)
					return
				}

				if cfg.AllowCredentials {
					w.Header().Set("Access-Control-Allow-Credentials", "true")
				}

				if exposedHeaders != "" {
					w.Header().Set("Access-Control-Expose-Headers", exposedHeaders)
				}

				if r.Method == http.MethodOptions {
					if allowedMethods != "" {
						w.Header().Set("Access-Control-Allow-Methods", allowedMethods)
					}
					if allowedHeaders != "" {
						w.Header().Set("Access-Control-Allow-Headers", allowedHeaders)
					}
					if cfg.MaxAgeSeconds > 0 {
						w.Header().Set("Access-Control-Max-Age", strconv.Itoa(cfg.MaxAgeSeconds))
					}
					w.WriteHeader(http.StatusNoContent)
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}
