package health

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/kunalPisolkar24/blogapp/services/content/pkg/logger"
)

type Check func(ctx context.Context) error

type Checker struct {
	checks  map[string]Check
	timeout time.Duration
}

func NewChecker(timeout time.Duration) *Checker {
	if timeout <= 0 {
		timeout = 2 * time.Second
	}
	return &Checker{
		checks:  make(map[string]Check),
		timeout: timeout,
	}
}

func (c *Checker) Register(name string, check Check) {
	c.checks[name] = check
}

type result struct {
	Name string `json:"name"`
	OK   bool   `json:"ok"`
	Err  string `json:"error,omitempty"`
}

type response struct {
	Status string   `json:"status"`
	Checks []result `json:"checks"`
}

func (c *Checker) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), c.timeout)
		defer cancel()

		var (
			mu       sync.Mutex
			wg       sync.WaitGroup
			results  = make([]result, 0, len(c.checks))
			allOK    = true
		)

		for name, check := range c.checks {
			wg.Add(1)
			go func(name string, check Check) {
				defer wg.Done()

				err := check(ctx)
				mu.Lock()
				defer mu.Unlock()
				res := result{Name: name, OK: err == nil}
				if err != nil {
					res.Err = err.Error()
					allOK = false
				}
				results = append(results, res)
			}(name, check)
		}
		wg.Wait()

		status := http.StatusOK
		overall := "ok"
		if !allOK {
			status = http.StatusServiceUnavailable
			overall = "unhealthy"
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		if err := json.NewEncoder(w).Encode(response{Status: overall, Checks: results}); err != nil {
			logger.Error("Failed to encode health response", "error", err)
		}
	})
}
