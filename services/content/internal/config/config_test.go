package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadConfigDefaults(t *testing.T) {
	cfg := LoadConfig()

	assert.Equal(t, "4002", cfg.Port)
	assert.Equal(t, "mongodb://localhost:27017", cfg.MongoURI)
	assert.Equal(t, "blog_content", cfg.DbName)
	assert.Equal(t, "localhost:6379", cfg.RedisAddr)
	assert.Equal(t, "", cfg.JwtSecret)
	assert.Equal(t, "user-service", cfg.JwtIssuer)
	assert.Equal(t, "topos", cfg.JwtAudience)
	assert.Equal(t, []string{"kafka-1:9092"}, cfg.KafkaBrokers)
	assert.Equal(t, "posts", cfg.KafkaTopic)
	assert.Equal(t, "user-interacted", cfg.KafkaUserInteractedTopic)
	assert.Equal(t, "content-summary-worker-group", cfg.KafkaConsumerGroupID)
	assert.Equal(t, "posts-dlq", cfg.KafkaDLQTopic)
	assert.Equal(t, 3, cfg.WorkerConcurrency)
	assert.Equal(t, "json", cfg.LogFormat)
	assert.Equal(t, "info", cfg.LogLevel)
	assert.Equal(t, "", cfg.OtelEndpoint)
}

func TestLoadConfigRateLimitDefaults(t *testing.T) {
	cfg := LoadConfig()

	assert.True(t, cfg.RateLimitEnabled)
	assert.Equal(t, 120, cfg.RateLimitReadsPerMin)
	assert.Equal(t, 30, cfg.RateLimitMutationsPerMin)
	assert.Equal(t, 60, cfg.RateLimitInteractionsPerMin)
	assert.Equal(t, 30, cfg.RateLimitSearchPerMin)
	assert.Equal(t, 10, cfg.RateLimitAIPerMin)
	assert.Equal(t, 60, cfg.RateLimitWindowSeconds)
	assert.Equal(t, 2, cfg.RateLimitDegradedMultiplier)
	assert.Equal(t, 1, cfg.RateLimitAIDegradedMultiplier)
	assert.Equal(t, 5, cfg.RateLimitAIConcurrency)
	assert.Equal(t, 150, cfg.RateLimitRedisTimeoutMs)
	assert.Equal(t, 10000, cfg.RateLimitMemoryMaxEntries)
}

func TestLoadConfigRateLimitFromEnv(t *testing.T) {
	t.Setenv("RATELIMIT_ENABLED", "false")
	t.Setenv("RATELIMIT_READS_PER_MIN", "200")
	t.Setenv("RATELIMIT_MUTATIONS_PER_MIN", "40")
	t.Setenv("RATELIMIT_INTERACTIONS_PER_MIN", "80")
	t.Setenv("RATELIMIT_SEARCH_PER_MIN", "50")
	t.Setenv("RATELIMIT_AI_PER_MIN", "5")
	t.Setenv("RATELIMIT_WINDOW_SECONDS", "30")
	t.Setenv("RATELIMIT_DEGRADED_MULTIPLIER", "3")
	t.Setenv("RATELIMIT_AI_DEGRADED_MULTIPLIER", "1")
	t.Setenv("RATELIMIT_AI_CONCURRENCY", "3")
	t.Setenv("RATELIMIT_REDIS_TIMEOUT_MS", "100")
	t.Setenv("RATELIMIT_MEMORY_MAX_ENTRIES", "500")

	cfg := LoadConfig()

	assert.False(t, cfg.RateLimitEnabled)
	assert.Equal(t, 200, cfg.RateLimitReadsPerMin)
	assert.Equal(t, 40, cfg.RateLimitMutationsPerMin)
	assert.Equal(t, 80, cfg.RateLimitInteractionsPerMin)
	assert.Equal(t, 50, cfg.RateLimitSearchPerMin)
	assert.Equal(t, 5, cfg.RateLimitAIPerMin)
	assert.Equal(t, 30, cfg.RateLimitWindowSeconds)
	assert.Equal(t, 3, cfg.RateLimitDegradedMultiplier)
	assert.Equal(t, 1, cfg.RateLimitAIDegradedMultiplier)
	assert.Equal(t, 3, cfg.RateLimitAIConcurrency)
	assert.Equal(t, 100, cfg.RateLimitRedisTimeoutMs)
	assert.Equal(t, 500, cfg.RateLimitMemoryMaxEntries)
}

func TestContentAliasForRateLimit(t *testing.T) {
	t.Setenv("CONTENT_RATELIMIT_READS_PER_MIN", "77")

	cfg := LoadConfig()

	assert.Equal(t, 77, cfg.RateLimitReadsPerMin)
}

func TestGetEnvBool(t *testing.T) {
	t.Setenv("FLAG", "false")
	assert.False(t, getEnvBool("FLAG", true))

	t.Setenv("FLAG", "0")
	assert.False(t, getEnvBool("FLAG", true))

	t.Setenv("FLAG", "true")
	assert.True(t, getEnvBool("FLAG", false))

	t.Setenv("FLAG", "bogus")
	assert.True(t, getEnvBool("FLAG", true), "unparseable values keep the default")
}

func TestLoadConfigFromEnv(t *testing.T) {
	t.Setenv("PORT", "5000")
	t.Setenv("MONGO_URI", "mongodb://mongo:27017")
	t.Setenv("DB_NAME", "test_db")
	t.Setenv("REDIS_ADDR", "redis:6380")
	t.Setenv("JWT_SECRET", "secret")
	t.Setenv("JWT_ISSUER", "issuer")
	t.Setenv("JWT_AUDIENCE", "audience")
	t.Setenv("AI_SERVICE_URL", "ai:50051")
	t.Setenv("KAFKA_BROKERS", "kafka-1:9092, kafka-2:9092,  ")
	t.Setenv("KAFKA_TOPIC", "events")
	t.Setenv("KAFKA_USER_INTERACTED_TOPIC", "interactions")
	t.Setenv("KAFKA_CONSUMER_GROUP_ID", "group")
	t.Setenv("KAFKA_DLQ_TOPIC", "dlq")
	t.Setenv("WORKER_CONCURRENCY", "7")
	t.Setenv("LOG_FORMAT", "text")
	t.Setenv("LOG_LEVEL", "debug")
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "collector:4317")

	cfg := LoadConfig()

	assert.Equal(t, "5000", cfg.Port)
	assert.Equal(t, "mongodb://mongo:27017", cfg.MongoURI)
	assert.Equal(t, "test_db", cfg.DbName)
	assert.Equal(t, "redis:6380", cfg.RedisAddr)
	assert.Equal(t, "secret", cfg.JwtSecret)
	assert.Equal(t, "issuer", cfg.JwtIssuer)
	assert.Equal(t, "audience", cfg.JwtAudience)
	assert.Equal(t, "ai:50051", cfg.AIServiceURL)
	assert.Equal(t, []string{"kafka-1:9092", "kafka-2:9092"}, cfg.KafkaBrokers)
	assert.Equal(t, "events", cfg.KafkaTopic)
	assert.Equal(t, "interactions", cfg.KafkaUserInteractedTopic)
	assert.Equal(t, "group", cfg.KafkaConsumerGroupID)
	assert.Equal(t, "dlq", cfg.KafkaDLQTopic)
	assert.Equal(t, 7, cfg.WorkerConcurrency)
	assert.Equal(t, "text", cfg.LogFormat)
	assert.Equal(t, "debug", cfg.LogLevel)
	assert.Equal(t, "collector:4317", cfg.OtelEndpoint)
}

func TestGetEnvIgnoresBlankValues(t *testing.T) {
	t.Setenv("PORT", "   ")

	assert.Equal(t, "4002", getEnv("PORT", "4002"))
}

func TestGetEnvInt(t *testing.T) {
	t.Setenv("WORKER_CONCURRENCY", "4")
	assert.Equal(t, 4, getEnvInt("WORKER_CONCURRENCY", 3))

	t.Setenv("WORKER_CONCURRENCY", "abc")
	assert.Equal(t, 3, getEnvInt("WORKER_CONCURRENCY", 3))

	t.Setenv("WORKER_CONCURRENCY", "0")
	assert.Equal(t, 3, getEnvInt("WORKER_CONCURRENCY", 3))
}

func TestSplitAndTrim(t *testing.T) {
	require.Equal(t, []string{"a", "b"}, splitAndTrim("a,b"))
	require.Equal(t, []string{"a", "b"}, splitAndTrim(" a , b "))
	require.Empty(t, splitAndTrim(" , "))
	require.Empty(t, splitAndTrim(""))
}
