from typing import List, Union
from pydantic import AnyHttpUrl, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "HERMES AI"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # JWT Security
    SECRET_KEY: str = "hermes-ai-super-secret-production-key-change-in-prod-26184"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # DB Connection
    DATABASE_URL: str = "postgresql+asyncpg://hermes_user:hermes_password@localhost:5500/sih_26184"
    SYNC_DATABASE_URL: str = "postgresql://hermes_user:hermes_password@localhost:5500/sih_26184"
    TEST_DATABASE_URL: str = "postgresql+asyncpg://hermes_user:hermes_password@localhost:5500/sih26184_test"
    SYNC_TEST_DATABASE_URL: str = "postgresql://hermes_user:hermes_password@localhost:5500/sih26184_test"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Default Passwords for development bootstrap
    DEFAULT_ADMIN_PASSWORD: str = "Admin@123"
    DEFAULT_INVESTIGATOR_PASSWORD: str = "Hermes@123"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
    ]

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")


settings = Settings()
