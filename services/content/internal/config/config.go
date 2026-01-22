package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port            string
	MongoURI        string
	DbName          string
	JwtSecret       string
	KafkaBrokers    []string
	KafkaTopic      string
	RedisAddrs      []string
	RedisMasterName string
	AIServiceURL    string
}

func LoadConfig() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	return &Config{
		Port:            getEnv("PORT", "4002"),
		MongoURI:        getEnv("MONGO_URI", "mongodb://localhost:27017"),
		DbName:          getEnv("DB_NAME", "blog_content"),
		JwtSecret:       getEnv("JWT_SECRET", "secret"),
		KafkaBrokers:    strings.Split(getEnv("KAFKA_BROKERS", "kafka-1:9092,kafka-2:9092,kafka-3:9092"), ","),
		KafkaTopic:      getEnv("KAFKA_TOPIC", "posts"),
		RedisAddrs:      strings.Split(getEnv("REDIS_ADDRS", "localhost:26379"), ","),
		RedisMasterName: getEnv("REDIS_MASTER_NAME", "mymaster"),
		AIServiceURL:    getEnv("AI_SERVICE_URL", "localhost:50051"),
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}