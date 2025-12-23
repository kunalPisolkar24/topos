package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	MongoURI     string
	DbName       string
	JwtSecret    string
	KafkaBrokers []string
	KafkaTopic   string
}

func LoadConfig() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	return &Config{
		Port:         getEnv("PORT", "4002"),
		MongoURI:     getEnv("MONGO_URI", "mongodb://localhost:27017"),
		DbName:       getEnv("DB_NAME", "blog_content"),
		JwtSecret:    getEnv("JWT_SECRET", "secret"),
		KafkaBrokers: []string{getEnv("KAFKA_BROKERS", "kafka:29092")},
		KafkaTopic:   getEnv("KAFKA_TOPIC", "posts"),
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}