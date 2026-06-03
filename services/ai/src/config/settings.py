from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PORT: str = "50051"
    METRICS_PORT: int = 12666
    LIGHTNING_AI_API_KEY: str
    LIGHTNING_AI_URL: str = "https://lightning.ai/api/v1/chat/completions"
    LIGHTNING_MODEL: str = "lightning-ai/gpt-oss-20b"
    LLM_REQUEST_TIMEOUT: int = 115
    LLM_HANDLER_TIMEOUT: int = 120
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()