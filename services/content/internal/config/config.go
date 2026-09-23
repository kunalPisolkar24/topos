package config

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
	"github.com/joho/godotenv"
)

type Config struct {
	EnvType                          string
	Port                             string
	MongoURI                         string
	DbName                           string
	RedisAddr                        string
	RedisPassword                    string
	JwtSecret                        string
	JwtIssuer                        string
	JwtAudience                      string
	InternalToken                    string
	AIServiceURL                     string
	KafkaBrokers                     []string
	KafkaTopic                       string
	KafkaUserInteractedTopic         string
	KafkaConsumerGroupID             string
	KafkaSearchConsumerGroupID       string
	KafkaPersonalizerConsumerGroupID string
	KafkaDLQTopic                    string
	WorkerConcurrency                int
	LogFormat                        string
	LogLevel                         string
	OtelEndpoint                     string
}

var loadOnce sync.Once

// LoadConfig reads configuration from the environment, falling back to a
// local .env file when present, then to sane defaults. When ENV_TYPE=prod
// it hydrates missing vars from SSM (/topos/content/config) and SM
// (topos/content/secrets) via the AWS SDK (Floci at http://localhost:4566
// or real AWS), mirroring the user service.
func LoadConfig() Config {
	loadEnvFile()
	if strings.TrimSpace(os.Getenv("ENV_TYPE")) == "prod" {
		loadFromAWS()
	}

	return Config{
		EnvType:                          getEnv("ENV_TYPE", "dev"),
		Port:                             getEnv("PORT", "4002"),
		MongoURI:                         getEnv("MONGO_URI", "mongodb://localhost:27017"),
		DbName:                           getEnv("DB_NAME", "blog_content"),
		RedisAddr:                        getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:                    getEnv("REDIS_PASSWORD", ""),
		JwtSecret:                        getEnv("JWT_SECRET", ""),
		JwtIssuer:                        getEnv("JWT_ISSUER", "user-service"),
		JwtAudience:                      getEnv("JWT_AUDIENCE", "topos"),
		InternalToken:                    getEnv("INTERNAL_TOKEN", ""),
		AIServiceURL:                     getEnv("AI_SERVICE_URL", "ai-service:50051"),
		KafkaBrokers:                     splitAndTrim(getEnv("KAFKA_BROKERS", "kafka-1:9092")),
		KafkaTopic:                       getEnv("KAFKA_TOPIC", "posts"),
		KafkaUserInteractedTopic:         getEnv("KAFKA_USER_INTERACTED_TOPIC", "user-interacted"),
		KafkaConsumerGroupID:             getEnv("KAFKA_CONSUMER_GROUP_ID", "content-summary-worker-group"),
		KafkaSearchConsumerGroupID:       getEnv("KAFKA_SEARCH_CONSUMER_GROUP_ID", "content-search-worker-group"),
		KafkaPersonalizerConsumerGroupID: getEnv("KAFKA_PERSONALIZER_CONSUMER_GROUP_ID", "content-personalizer-worker-group"),
		KafkaDLQTopic:                    getEnv("KAFKA_DLQ_TOPIC", "posts-dlq"),
		WorkerConcurrency:                getEnvInt("WORKER_CONCURRENCY", 3),
		LogFormat:                        getEnv("LOG_FORMAT", "json"),
		LogLevel:                         getEnv("LOG_LEVEL", "info"),
		OtelEndpoint:                     getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
	}
}

func loadFromAWS() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	region := getEnv("AWS_REGION", "ap-south-1")
	endpoint := strings.TrimSpace(os.Getenv("AWS_ENDPOINT_URL"))
	secretsName := getEnv("CONTENT_SECRETS_NAME", "topos/content/secrets")
	configParam := getEnv("CONTENT_CONFIG_PARAM", "/topos/content/config")

	cfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(region))
	if err != nil {
		slog.Warn("content config: AWS load failed", "error", err)
		return
	}
	if endpoint != "" {
		cfg.BaseEndpoint = aws.String(endpoint)
		// Floci uses dummy creds.
		if os.Getenv("AWS_ACCESS_KEY_ID") == "" {
			_ = os.Setenv("AWS_ACCESS_KEY_ID", "test")
		}
		if os.Getenv("AWS_SECRET_ACCESS_KEY") == "" {
			_ = os.Setenv("AWS_SECRET_ACCESS_KEY", "test")
		}
	}

	// SSM — JSON blob
	func() {
		client := ssm.NewFromConfig(cfg)
		if endpoint != "" {
			// Override endpoint for Floci.
			client = ssm.NewFromConfig(cfg, func(o *ssm.Options) {
				o.BaseEndpoint = aws.String(endpoint)
			})
		}
		out, err := client.GetParameter(ctx, &ssm.GetParameterInput{Name: aws.String(configParam)})
		if err != nil {
			// NotFound is not fatal; just warn if other error.
			slog.Debug("content config: SSM fetch failed", "param", configParam, "error", err)
			return
		}
		if out.Parameter != nil && out.Parameter.Value != nil {
			var parsed map[string]string
			if err := json.Unmarshal([]byte(*out.Parameter.Value), &parsed); err == nil {
				for k, v := range parsed {
					if strings.TrimSpace(v) != "" && os.Getenv(k) == "" {
						_ = os.Setenv(k, v)
					}
				}
			}
		}
	}()

	// SM — JSON blob
	func() {
		client := secretsmanager.NewFromConfig(cfg)
		if endpoint != "" {
			client = secretsmanager.NewFromConfig(cfg, func(o *secretsmanager.Options) {
				o.BaseEndpoint = aws.String(endpoint)
			})
		}
		out, err := client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{SecretId: aws.String(secretsName)})
		if err != nil {
			slog.Debug("content config: SM fetch failed", "secret", secretsName, "error", err)
			return
		}
		if out.SecretString != nil {
			var parsed map[string]string
			if err := json.Unmarshal([]byte(*out.SecretString), &parsed); err == nil {
				for k, v := range parsed {
					if strings.TrimSpace(v) != "" && os.Getenv(k) == "" {
						_ = os.Setenv(k, v)
					}
				}
			}
		}
	}()
}

func loadEnvFile() {
	loadOnce.Do(func() {
		_ = godotenv.Load()
	})
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists && strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(os.Getenv(key)))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func splitAndTrim(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
