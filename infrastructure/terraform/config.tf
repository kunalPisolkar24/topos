# =============================================================================
# Topos — SSM Parameter Store (non-secret service config)
# =============================================================================

resource "aws_ssm_parameter" "user_config" {
  name = "/topos/user/config"
  type = "String"
  value = jsonencode({
    PORT                               = "4001"
    LOG_LEVEL                          = "info"
    OTEL_SERVICE_NAME                  = "user-service"
    JWT_ISSUER                         = "user-service"
    JWT_AUDIENCE                       = "topos"
    JWT_EXPIRES_IN                     = "7d"
    REDIS_CACHE_TTL_MS                 = "3600000"
    REDIS_MISSING_CACHE_TTL_MS         = "60000"
    RATELIMIT_ENABLED                  = "true"
    RATELIMIT_SIGNUP_PER_MIN           = "5"
    RATELIMIT_SIGNIN_PER_MIN           = "10"
    RATELIMIT_MUTATIONS_PER_MIN        = "30"
    RATELIMIT_READS_PER_MIN            = "120"
    RATELIMIT_WINDOW_SECONDS           = "60"
    RATELIMIT_DEGRADED_MULTIPLIER      = "2"
    RATELIMIT_AUTH_DEGRADED_MULTIPLIER = "1"
    RATELIMIT_AUTH_CONCURRENCY         = "5"
    RATELIMIT_REDIS_TIMEOUT_MS         = "150"
    RATELIMIT_MEMORY_MAX_ENTRIES       = "10000"
    PG_POOL_MAX                        = "10"
    PG_POOL_IDLE_TIMEOUT_MS            = "30000"
    PG_POOL_CONNECTION_TIMEOUT_MS      = "5000"
  })
  description = "User service non-secret config"
  tags        = local.common_tags

  # Floci's SSM is in-memory; no KMS.
}

resource "aws_ssm_parameter" "ai_config" {
  name = "/topos/ai/config"
  type = "String"
  value = jsonencode({
    CHECKPOINT_POOL_MIN_SIZE   = "1"
    CHECKPOINT_POOL_MAX_SIZE   = "10"
    CHECKPOINT_STARTUP_RETRIES = "12"
  })
  description = "AI service non-secret config"
  tags        = local.common_tags

  # Floci's SSM is in-memory; no KMS.
}

resource "aws_ssm_parameter" "content_config" {
  name = "/topos/content/config"
  type = "String"
  value = jsonencode({
    PORT                                 = "4002"
    DB_NAME                              = "blog_content"
    LOG_LEVEL                            = "info"
    LOG_FORMAT                           = "json"
    OTEL_SERVICE_NAME                    = "content-service"
    OTEL_EXPORTER_OTLP_ENDPOINT          = ""
    JWT_ISSUER                           = "user-service"
    JWT_AUDIENCE                         = "topos"
    KAFKA_TOPIC                          = "posts"
    KAFKA_USER_INTERACTED_TOPIC          = "user-interacted"
    KAFKA_DLQ_TOPIC                      = "posts-dlq"
    KAFKA_CONSUMER_GROUP_ID              = "content-summary-worker-group"
    KAFKA_SEARCH_CONSUMER_GROUP_ID       = "content-search-worker-group"
    KAFKA_PERSONALIZER_CONSUMER_GROUP_ID = "content-personalizer-worker-group"
    WORKER_CONCURRENCY                   = "3"
    RATELIMIT_ENABLED                    = "true"
    RATELIMIT_READS_PER_MIN              = "120"
    RATELIMIT_MUTATIONS_PER_MIN          = "30"
    RATELIMIT_INTERACTIONS_PER_MIN       = "60"
    RATELIMIT_SEARCH_PER_MIN             = "30"
    RATELIMIT_AI_PER_MIN                 = "10"
    RATELIMIT_WINDOW_SECONDS             = "60"
    RATELIMIT_DEGRADED_MULTIPLIER        = "2"
    RATELIMIT_AI_DEGRADED_MULTIPLIER     = "1"
    RATELIMIT_AI_CONCURRENCY             = "5"
    RATELIMIT_REDIS_TIMEOUT_MS           = "150"
    RATELIMIT_MEMORY_MAX_ENTRIES         = "10000"
  })
  description = "Content service non-secret config"
  tags        = local.content_tags
}
