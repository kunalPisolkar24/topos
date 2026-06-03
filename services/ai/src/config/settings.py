from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PORT: str = "50051"
    METRICS_PORT: int = 12666
    LIGHTNING_AI_API_KEY: str = ""
    LIGHTNING_AI_URL: str = "https://lightning.ai/api/v1/chat/completions"
    LIGHTNING_MODEL: str = "lightning-ai/gpt-oss-20b"
    TIMEOUT_SECONDS: int = 60
    LOG_LEVEL: str = "INFO"
    LOAD_TEST_MODE: bool = False
    MOCK_DELAY_MS: int = 5

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()