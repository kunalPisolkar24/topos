package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLoadConfig_RequiresJWTSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "")

	_, err := LoadConfig()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "JWT_SECRET")
}

func TestLoadConfig_AcceptsValidJWTSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret-value")

	cfg, err := LoadConfig()
	assert.NoError(t, err)
	assert.NotNil(t, cfg)
	assert.Equal(t, "test-secret-value", cfg.JwtSecret)
}

func TestLoadConfig_TrimsWhitespaceJWTSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "   ")

	_, err := LoadConfig()
	assert.Error(t, err)
}

func TestLoadConfig_DefaultCORSOrigins(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")

	cfg, err := LoadConfig()
	assert.NoError(t, err)
	assert.Equal(t, []string{"*"}, cfg.CORSOrigins)
}

func TestLoadConfig_ConfiguredCORSOrigins(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com, https://admin.example.com")

	cfg, err := LoadConfig()
	assert.NoError(t, err)
	assert.Equal(t, []string{"https://app.example.com", "https://admin.example.com"}, cfg.CORSOrigins)
}
