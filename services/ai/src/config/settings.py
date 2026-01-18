from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: str = "50051"
    METRICS_PORT: int = 12666
    LIGHTNING_AI_API_KEY: str
    LIGHTNING_AI_URL: str = "https://lightning.ai/api/v1/chat/completions"
    LIGHTNING_MODEL: str = "lightning-ai/gpt-oss-20b"
    TIMEOUT_SECONDS: int = 60
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"

settings = Settings()