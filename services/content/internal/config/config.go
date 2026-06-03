package config

import (
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port            string
	Environment     string
	MongoURI        string
	DbName          string
	JwtSecret       string
	KafkaBrokers    []string
	KafkaTopic      string
	KafkaConsumerGroupID string
	KafkaConsumerTopics  []string
	KafkaDLQTopic        string
	RedisAddrs      []string
	RedisMasterName string
	RedisURL        string
	RedisMode       string
	AIServiceURL    string
	AIRequired      bool
	AIDialTimeout   time.Duration
}

var envLoadOnce sync.Once

func LoadConfig() *Config {
	loadEnvIfPresent()

	kafkaTopic := getEnvAny([]string{"CONTENT_KAFKA_TOPIC", "KAFKA_TOPIC"}, "posts")
	kafkaConsumerTopics := splitAndTrim(getEnv("KAFKA_CONSUMER_TOPICS", ""))
	if len(kafkaConsumerTopics) == 0 {
		kafkaConsumerTopics = splitAndTrim(kafkaTopic)
	}

	return &Config{
		Port:            getEnv("PORT", "4002"),
		Environment:     getEnv("APP_ENV", "development"),
		MongoURI:        getEnv("MONGO_URI", "mongodb://localhost:27017"),
		DbName:          getEnv("DB_NAME", "blog_content"),
		JwtSecret:       getEnv("JWT_SECRET", "secret"),
		KafkaBrokers:    splitAndTrim(getEnv("KAFKA_BROKERS", "kafka-1:9092,kafka-2:9092,kafka-3:9092")),
		KafkaTopic:      kafkaTopic,
		KafkaConsumerGroupID: getEnv("KAFKA_CONSUMER_GROUP_ID", "content-summary-worker-group"),
		KafkaConsumerTopics:  kafkaConsumerTopics,
		KafkaDLQTopic:       getEnv("KAFKA_DLQ_TOPIC", kafkaTopic+"-dlq"),
		RedisAddrs:      splitAndTrim(getEnv("REDIS_ADDRS", "")),
		RedisMasterName: getEnv("REDIS_MASTER_NAME", ""),
		RedisURL:        getEnv("REDIS_URL", "redis://localhost:6379"),
		RedisMode:       detectRedisMode(),
		AIServiceURL:    getEnvAny([]string{"AI_SERVICE_URL", "AI_SERVICE_ADDR"}, "ai-service:50051"),
		AIRequired:      getEnvBool("AI_REQUIRED", false),
		AIDialTimeout:   time.Duration(getEnvInt("AI_DIAL_TIMEOUT_SECONDS", 5)) * time.Second,
	}
}

func loadEnvIfPresent() {
	envLoadOnce.Do(func() {
		paths := []string{
			".env",
			"/app/.env",
			"../.env",
			"../../.env",
			"../../../.env",
		}

		for _, path := range paths {
			if _, err := os.Stat(path); err == nil {
				_ = godotenv.Overload(path)
				return
			}
		}
	})
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists && strings.TrimSpace(value) != "" {
		return value
	}
	return fallback
}

func getEnvAny(keys []string, fallback string) string {
	for _, key := range keys {
		if value, exists := os.LookupEnv(key); exists && strings.TrimSpace(value) != "" {
			return value
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	raw, exists := os.LookupEnv(key)
	if !exists {
		return fallback
	}

	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func getEnvInt(key string, fallback int) int {
	raw, exists := os.LookupEnv(key)
	if !exists {
		return fallback
	}

	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func splitAndTrim(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func detectRedisMode() string {
	masterName, exists := os.LookupEnv("REDIS_MASTER_NAME")
	if exists && strings.TrimSpace(masterName) != "" {
		return "sentinel"
	}
	return "standalone"
}
